"""Offline-to-Online Batch Synchronization Service.

Replaces global in-memory queue with MongoDB deduplication and server-authoritative re-scoring.
"""

import logging
from datetime import UTC, datetime, timedelta

from app.db import get_database
from app.models.sync import SyncBatchRequest, SyncBatchResponse
from app.services.mastery_service import get_mastery_service
from app.services.profile_service import get_profile_service
from app.services.quiz_service import get_quiz_service

logger = logging.getLogger("ekalsahayak.sync")

MAX_EVENT_AGE_DAYS = 30
MAX_CLOCK_SKEW_MINUTES = 10


class SyncService:
    """Processes offline outbox batches with anti-cheat and deduplication."""

    async def process_batch(self, user_id: str, batch: SyncBatchRequest) -> SyncBatchResponse:
        """Processes and reconciles queued offline events."""
        db = get_database()
        quiz_svc = get_quiz_service()
        mastery_svc = get_mastery_service()
        profile_svc = get_profile_service()

        now = datetime.now(UTC)
        min_allowed_ts = now - timedelta(days=MAX_EVENT_AGE_DAYS)
        max_allowed_ts = now + timedelta(minutes=MAX_CLOCK_SKEW_MINUTES)

        synced_count = 0
        skipped_count = 0

        for event in batch.actions:
            # 1. Validate timestamp boundaries
            event_ts = event.client_ts
            if event_ts.tzinfo is None:
                event_ts = event_ts.replace(tzinfo=UTC)

            if event_ts < min_allowed_ts or event_ts > max_allowed_ts:
                logger.warning(
                    "Skipping event %s: invalid timestamp %s outside valid window.",
                    event.event_id,
                    event_ts,
                )
                skipped_count += 1
                continue

            # 2. Check for duplicate event_id
            existing = await db.sync_events.find_one({
                "user_id": str(user_id),
                "event_id": event.event_id,
            })
            if existing:
                logger.info("Event %s already synced. Skipping.", event.event_id)
                skipped_count += 1
                continue

            # 3. Server-authoritative re-evaluation
            if event.type == "quiz_answer" and event.question_id and event.selected_index is not None:
                q = await quiz_svc.get_question(event.question_id)
                if q:
                    correct_idx = q.get("correct_index", 0)
                    is_correct = event.selected_index == correct_idx
                    topic = q.get("topic", "evaporation")

                    # Idempotent mastery update
                    await mastery_svc.apply_quiz_result(
                        user_id=user_id,
                        topic=topic,
                        question_id=event.question_id,
                        attempt_id=event.event_id,
                        is_correct=is_correct,
                    )
                    await profile_svc.register_quiz_outcome(user_id, topic, is_correct)

            # 4. Record event as processed in MongoDB
            await db.sync_events.insert_one({
                "user_id": str(user_id),
                "event_id": event.event_id,
                "type": event.type,
                "client_ts": event_ts,
                "synced_at": now,
            })
            synced_count += 1

        # Fetch latest profile mastery
        profile = await profile_svc.get_or_create_profile(user_id)
        current_mastery = profile.get("mastery_graph", {})

        return SyncBatchResponse(
            synced_count=synced_count,
            skipped_count=skipped_count,
            updated_mastery=current_mastery,
            message=f"Successfully synchronized {synced_count} offline actions ({skipped_count} skipped/deduped).",
        )


# Global singleton instance
sync_service = SyncService()


def get_sync_service() -> SyncService:
    return sync_service
