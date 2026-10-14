"""Student Profile & Mastery Graph Service.

Replaces global in-memory state with MongoDB persistence.
Handles:
- Per-user mastery graph and retention scoring
- Scoped misconception tracking ({concept_id, text, first_seen, resolved, correct_count})
- Misconception resolution upon 2 consecutive correct answers
- Real timestamped follow-up scheduling when mastery < 0.5
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from app.db import get_database

logger = logging.getLogger("ekalsahayak.profile")


class ProfileService:
    """Manages student learning profile in MongoDB."""

    async def get_or_create_profile(self, user_id: str, default_grade: str = "Class 9") -> dict[str, Any]:
        """Retrieves persistent student profile from Mongo, creating if missing."""
        db = get_database()
        profile = await db.profiles.find_one({"user_id": user_id})

        if not profile:
            now = datetime.now(UTC)
            profile_data = {
                "user_id": user_id,
                "grade": default_grade,
                "language": "odia",
                "mastery_graph": {},
                "retention_scores": {},
                "evidence_count": {},
                "confidence": {},
                "diagnostic_completed": False,
                "diagnostic_score": None,
                "misconceptions": [],  # List of {concept_id, text, first_seen, resolved, correct_count}
                "scheduled_followups": [],
                "time_budget_minutes": 45,
                "streak_days": 0,
                "created_at": now,
                "updated_at": now,
            }
            await db.profiles.insert_one(profile_data)
            profile = profile_data

        return profile

    async def record_misconception(self, user_id: str, concept_id: str, text: str) -> None:
        """Records a diagnosed misconception if not already tracked or resolved."""
        db = get_database()
        profile = await self.get_or_create_profile(user_id)
        misconceptions = profile.get("misconceptions", [])

        now_iso = datetime.now(UTC).isoformat()
        for item in misconceptions:
            if item.get("concept_id") == concept_id:
                if item.get("resolved"):
                    # Re-opened if student demonstrated misunderstanding again
                    item["resolved"] = False
                    item["correct_count"] = 0
                    item["last_seen"] = now_iso
                return

        misconceptions.append({
            "concept_id": concept_id,
            "text": text,
            "first_seen": now_iso,
            "last_seen": now_iso,
            "correct_count": 0,
            "resolved": False,
        })

        await db.profiles.update_one(
            {"user_id": user_id},
            {"$set": {"misconceptions": misconceptions, "updated_at": datetime.now(UTC)}},
        )

    async def register_quiz_outcome(self, user_id: str, topic: str, is_correct: bool) -> None:
        """Updates misconception resolution state.

        Resolves misconception when student answers correctly twice for that concept.
        """
        db = get_database()
        profile = await self.get_or_create_profile(user_id)
        misconceptions = profile.get("misconceptions", [])
        changed = False

        for item in misconceptions:
            if item.get("concept_id") == topic and not item.get("resolved"):
                if is_correct:
                    item["correct_count"] = item.get("correct_count", 0) + 1
                    if item["correct_count"] >= 2:
                        item["resolved"] = True
                        item["resolved_at"] = datetime.now(UTC).isoformat()
                        logger.info("Student %s resolved misconception for %s!", user_id, topic)
                    changed = True
                else:
                    item["correct_count"] = 0
                    changed = True

        if changed:
            await db.profiles.update_one(
                {"user_id": user_id},
                {"$set": {"misconceptions": misconceptions, "updated_at": datetime.now(UTC)}},
            )

    async def schedule_followup_if_needed(self, user_id: str, topic: str, current_mastery: float) -> str | None:
        """Schedules a spaced repetition follow-up when mastery < 0.5 with real ISO timestamps."""
        if current_mastery >= 0.50:
            return None

        db = get_database()
        now = datetime.now(UTC)
        # Schedule next session 24 hours from now
        scheduled_time = now + timedelta(days=1)
        followup_iso = scheduled_time.isoformat()

        followup_entry = {
            "topic": topic,
            "scheduled_time": followup_iso,
            "created_at": now.isoformat(),
            "reason": f"Mastery for {topic} is {current_mastery:.2f} (under 0.50 threshold)",
        }

        # Replace or add entry for topic
        await db.profiles.update_one(
            {"user_id": user_id},
            {
                "$pull": {"scheduled_followups": {"topic": topic}},
            },
        )
        await db.profiles.update_one(
            {"user_id": user_id},
            {
                "$push": {"scheduled_followups": followup_entry},
                "$set": {"updated_at": now},
            },
        )

        return followup_iso

    async def get_due_followups(self, user_id: str) -> list[dict[str, Any]]:
        """Returns follow-ups that are due as of the current timestamp."""
        profile = await self.get_or_create_profile(user_id)
        now_iso = datetime.now(UTC).isoformat()
        followups = profile.get("scheduled_followups", [])
        return [f for f in followups if f.get("scheduled_time", "") <= now_iso]


# Global singleton instance
profile_service = ProfileService()


def get_profile_service() -> ProfileService:
    return profile_service
