"""Mastery & Scoring Service with Anti-Cheat & Daily Caps.

Implements:
- Server-authoritative answer scoring
- Idempotent attempt processing via unique (user_id, question_id, attempt_id)
- Daily mastery gain cap per topic (+0.30/day maximum) to prevent farming
- Atomic MongoDB mastery updates clamped to [0.0, 1.0]
"""

import logging
from datetime import UTC, datetime
from typing import Any

from app.db import get_database

logger = logging.getLogger("ekalsahayak.mastery")

DAILY_MASTERY_GAIN_CAP = 0.30


class MasteryService:
    """Handles mastery calculation and idempotent anti-farming updates."""

    async def get_daily_gain(self, user_id: str, topic: str) -> float:
        """Computes total mastery gained by user for topic during today's UTC day."""
        db = get_database()
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

        pipeline: list[dict[str, Any]] = [
            {
                "$match": {
                    "user_id": user_id,
                    "topic": topic,
                    "created_at": {"$gte": today_start},
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_gain": {"$sum": "$mastery_delta"},
                }
            },
        ]
        res = await db.mastery_history.aggregate(pipeline).to_list(1)
        if res and len(res) > 0:
            return float(res[0].get("total_gain", 0.0))
        return 0.0

    async def apply_quiz_result(
        self,
        user_id: str,
        topic: str,
        question_id: str,
        attempt_id: str,
        is_correct: bool,
    ) -> tuple[float, bool]:
        """Atomically updates mastery in MongoDB with idempotency & daily capping.

        Returns: (new_mastery, is_capped)
        """
        db = get_database()

        # 1. Idempotency Check: Did this attempt already process?
        existing_attempt = await db.quiz_attempts.find_one({
            "user_id": user_id,
            "question_id": question_id,
            "attempt_id": attempt_id,
        })
        if existing_attempt:
            logger.info("Duplicate attempt detected (attempt_id=%s). Returning cached mastery.", attempt_id)
            profile = await db.profiles.find_one({"user_id": user_id})
            current_m = profile.get("mastery_graph", {}).get(topic, 0.5) if profile else 0.5
            return current_m, False

        # 2. Compute candidate delta
        raw_delta = 0.08 if is_correct else -0.04

        # 3. Apply Daily Cap for positive gains
        is_capped = False
        effective_delta = raw_delta
        if raw_delta > 0:
            today_gain = await self.get_daily_gain(user_id, topic)
            if today_gain >= DAILY_MASTERY_GAIN_CAP:
                effective_delta = 0.0
                is_capped = True
                logger.info("User %s reached daily mastery cap on %s (+%.2f/day)", user_id, topic, today_gain)
            elif today_gain + raw_delta > DAILY_MASTERY_GAIN_CAP:
                effective_delta = DAILY_MASTERY_GAIN_CAP - today_gain
                is_capped = True

        # 4. Record Attempt & History
        now = datetime.now(UTC)
        await db.quiz_attempts.insert_one({
            "user_id": user_id,
            "question_id": question_id,
            "attempt_id": attempt_id,
            "topic": topic,
            "is_correct": is_correct,
            "effective_delta": effective_delta,
            "created_at": now,
        })

        if effective_delta > 0:
            await db.mastery_history.insert_one({
                "user_id": user_id,
                "topic": topic,
                "mastery_delta": effective_delta,
                "created_at": now,
            })

        # 5. Atomic MongoDB Update & Clamp in [0.0, 1.0]
        # Fetch current score to clamp precisely
        profile = await db.profiles.find_one({"user_id": user_id})
        current_val = 0.40
        if profile and "mastery_graph" in profile:
            current_val = profile["mastery_graph"].get(topic, 0.40)

        new_val = max(0.0, min(1.0, current_val + effective_delta))

        await db.profiles.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    f"mastery_graph.{topic}": round(new_val, 4),
                    "updated_at": now,
                }
            },
            upsert=True,
        )

        rounded_val = round(new_val, 4)
        return rounded_val, is_capped


# Global singleton instance
mastery_service = MasteryService()


def get_mastery_service() -> MasteryService:
    return mastery_service
