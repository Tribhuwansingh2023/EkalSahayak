"""Learning Gap Detector Service for EkalSahayak.

Identifies weak concepts based on real quiz & diagnostic assessment evidence,
recommends targeted revision lessons (Odia vernacular + rural examples),
and handles quiz retakes with honest pre/post performance comparisons.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from app.db import get_database
from app.rag.curriculum_builder import get_all_concepts, get_concept_by_id
from app.services.kb_service import get_kb_service
from app.services.profile_service import get_profile_service

logger = logging.getLogger("ekalsahayak.learning_gaps")

# Canonical Curriculum Topic to Concept Mapping
CORE_CONCEPTS_MAP: list[dict[str, Any]] = [
    {
        "id": "evaporation",
        "concept_id": "sci_ch1_c5_evaporation",
        "name": "Matter & Evaporation",
        "name_odia": "ବାଷ୍ପୀଭବନ ଓ ଶୀତଳୀକରଣ",
        "chapter": "Chapter 1: Matter in Our Surroundings",
        "subject": "Science",
        "grade": "Class 9",
        "quiz_topic": "evaporation",
        "rural_context": "Porous earthen water pot (mati matia) cooling in summer",
        "revision_reason": "Master latent heat of vaporization and factors affecting cooling rate.",
    },
    {
        "id": "latent_heat",
        "concept_id": "sci_ch1_c4_change_of_state",
        "name": "Change of State & Latent Heat",
        "name_odia": "ଅବସ୍ଥା ପରିବର୍ତ୍ତନ ଓ ଲୀନ ତାପ",
        "chapter": "Chapter 1: Matter in Our Surroundings",
        "subject": "Science",
        "grade": "Class 9",
        "quiz_topic": "latent_heat",
        "rural_context": "Constant temperature during boiling river water on a chulha",
        "revision_reason": "Understand why temperature stays constant during phase change.",
    },
    {
        "id": "cell_biology",
        "concept_id": "sci_ch5_c1_cell_discovery",
        "name": "Cell Biology (Structure & Function)",
        "name_odia": "କୋଷ ଜୀବବିଜ୍ଞାନ",
        "chapter": "Chapter 5: The Fundamental Unit of Life",
        "subject": "Science",
        "grade": "Class 9",
        "quiz_topic": "cell_biology",
        "rural_context": "Onion peel membrane microscope observation in school lab",
        "revision_reason": "Reinforce cell organelles, plasma membrane, and cellular organization.",
    },
    {
        "id": "mitochondria",
        "concept_id": "sci_ch5_c5_mitochondria_plastids",
        "name": "Cell Organelles (Mitochondria & ATP)",
        "name_odia": "ମାଇଟୋକଣ୍ଡ୍ରିଆ ଓ ଶକ୍ତି ମୁଦ୍ରା",
        "chapter": "Chapter 5: The Fundamental Unit of Life",
        "subject": "Science",
        "grade": "Class 9",
        "quiz_topic": "mitochondria",
        "rural_context": "Cell energy production compared to a village biogas or power plant",
        "revision_reason": "Differentiate ATP synthesis from other organelle functions.",
    },
    {
        "id": "motion",
        "concept_id": "sci_ch8_c1_motion_reference",
        "name": "Motion & Reference Points",
        "name_odia": "ଗତି ଓ ସନ୍ଦର୍ଭ ବିନ୍ଦୁ",
        "chapter": "Chapter 8: Motion",
        "subject": "Science",
        "grade": "Class 9",
        "quiz_topic": "motion",
        "rural_context": "Observing a passing bullock cart relative to roadside banyan tree",
        "revision_reason": "Clarify scalar distance vs vector displacement with reference points.",
    },
    {
        "id": "force",
        "concept_id": "sci_ch8_c4_first_law_inertia",
        "name": "Force & Laws of Motion (Inertia)",
        "name_odia": "ବଳ ଓ ଗତିର ନିୟମ",
        "chapter": "Chapter 9: Force and Laws of Motion",
        "subject": "Science",
        "grade": "Class 9",
        "quiz_topic": "force",
        "rural_context": "Dust particles flying out when shaking a village coir mat",
        "revision_reason": "Master Newton's First Law and qualitative inertia fundamentals.",
    },
]


class LearningGapService:
    """Detects real learning gaps and coordinates targeted revision & retake."""

    async def get_learning_gaps(self, user_id: str, lang: str = "en") -> dict[str, Any]:
        """Analyzes student assessment history to detect weak concepts needing practice."""
        db = get_database()
        profile_svc = get_profile_service()
        kb = get_kb_service()
        profile = await profile_svc.get_or_create_profile(user_id)

        mastery_graph: dict[str, float] = profile.get("mastery_graph", {})
        evidence_count: dict[str, int] = profile.get("evidence_count", {})
        misconceptions: list[dict[str, Any]] = profile.get("misconceptions", [])
        diagnostic_completed: bool = profile.get("diagnostic_completed", False)

        # Retrieve quiz attempts
        attempts = []
        try:
            cursor = db.quiz_attempts.find({"user_id": user_id}).sort("created_at", -1)
            async for att in cursor:
                attempts.append(att)
        except Exception:
            attempts = []

        # Check if student has completed any valid assessment
        has_assessment_data = bool(diagnostic_completed or attempts or (mastery_graph and any(v > 0 for v in mastery_graph.values())))

        if not has_assessment_data:
            # Honest empty state per Requirement 5 & 6
            untested_concepts = []
            for item in CORE_CONCEPTS_MAP:
                untested_concepts.append({
                    "id": item["id"],
                    "concept_id": item["concept_id"],
                    "name": item["name"],
                    "chapter": item["chapter"],
                    "subject": item["subject"],
                    "grade": item["grade"],
                    "state": "not_assessed",
                    "status_label": "Not assessed",
                    "mastery_percent": None,
                    "has_assessment": False,
                })

            return {
                "has_assessment_data": False,
                "student_id": user_id,
                "student_grade": profile.get("grade", "Class 9"),
                "message": "No assessment data yet. Complete a short quiz to identify concepts that need practice.",
                "weak_concepts": [],
                "all_concepts": untested_concepts,
                "quiz_action_available": True,
                "default_quiz_topic": "evaporation",
            }

        # Student has assessment data: Calculate learning gaps rigorously
        weak_concepts: list[dict[str, Any]] = []
        all_concepts_status: list[dict[str, Any]] = []
        diag_result = profile.get("diagnostic_result") or {}
        diag_breakdown = diag_result.get("breakdown", []) if isinstance(diag_result, dict) else []

        for item in CORE_CONCEPTS_MAP:
            cid = item["id"]
            full_concept_id = item["concept_id"]

            # Match diagnostic attempt breakdown if available
            matching_diag = next(
                (b for b in diag_breakdown if b.get("concept_id") in (cid, full_concept_id) or b.get("topic_id") == cid),
                None
            )

            # Check mastery from profile (supports both topic key and full concept_id)
            raw_mastery = mastery_graph.get(cid)
            if raw_mastery is None:
                raw_mastery = mastery_graph.get(full_concept_id)

            ev_cnt = evidence_count.get(cid, 0)
            if ev_cnt == 0:
                ev_cnt = evidence_count.get(full_concept_id, 0)

            # Query attempts for this concept
            concept_attempts = [a for a in attempts if a.get("topic") == item["quiz_topic"] or a.get("topic") == cid]
            incorrect_attempts = [a for a in concept_attempts if not a.get("is_correct")]

            # Active unresolved misconceptions
            active_misc = [
                m for m in misconceptions
                if (m.get("concept_id") in (cid, full_concept_id) or cid in m.get("concept_id", "") or m.get("topic_id") == cid)
                and not m.get("resolved")
            ]

            has_concept_assessment = (raw_mastery is not None) or (len(concept_attempts) > 0) or (ev_cnt > 0)

            if not has_concept_assessment:
                # Untested concept -> "Not assessed", NEVER "0%"
                all_concepts_status.append({
                    "id": cid,
                    "concept_id": full_concept_id,
                    "name": item["name"],
                    "chapter": item["chapter"],
                    "subject": item["subject"],
                    "grade": item["grade"],
                    "state": "not_assessed",
                    "status_label": "Not assessed",
                    "mastery_percent": None,
                    "has_assessment": False,
                })
                continue

            # Normalized mastery ratio
            m_val = float(raw_mastery) if raw_mastery is not None else 0.5
            if m_val > 1.0:
                m_val = m_val / 100.0
            mastery_pct = round(m_val * 100)

            # Check if flagged for unverified mapping
            if matching_diag and matching_diag.get("flagged_for_review"):
                state = "needs_review"
                status_label = "Needs Review"
                is_weak = False
            elif is_insufficient := (ev_cnt == 0 and len(concept_attempts) == 0 and raw_mastery is not None and raw_mastery == 0.5):
                state = "insufficient_data"
                status_label = "Insufficient Data"
                is_weak = False
            else:
                # State classification rule:
                # - Mastered: >= 0.80 and no active misconceptions
                # - In progress: 0.50 <= mastery < 0.80 and no active misconceptions
                # - Needs practice: mastery < 0.50 OR active misconception OR majority incorrect attempts
                is_weak = (m_val < 0.50) or (len(active_misc) > 0) or (len(incorrect_attempts) > 0 and len(incorrect_attempts) >= len(concept_attempts))
                if is_weak:
                    state = "needs_practice"
                    status_label = "Needs practice"
                elif m_val >= 0.80:
                    state = "mastered"
                    status_label = "Mastered"
                else:
                    state = "in_progress"
                    status_label = "In progress"

            if is_weak:
                # Construct honest explanation why it was flagged
                misc_evidence = None
                if matching_diag and not matching_diag.get("correct"):
                    detected_misc = matching_diag.get("misconception_detected")
                    flag_reason = (
                        f"Flagged from diagnostic response: {detected_misc}"
                        if detected_misc
                        else f"Missed baseline diagnostic question ({matching_diag.get('citation', 'NCERT Class 9')})."
                    )
                    misc_evidence = {
                        "misconception": detected_misc or "Conceptual review recommended",
                        "question_prompt": matching_diag.get("prompt"),
                        "selected_answer": matching_diag.get("selected_text"),
                        "correct_answer": matching_diag.get("correct_text"),
                        "citation": matching_diag.get("citation"),
                        "chapter": matching_diag.get("chapter"),
                        "page": matching_diag.get("page"),
                        "flagged_for_review": False,
                    }
                elif active_misc:
                    misc_text = active_misc[0].get("text") or active_misc[0].get("indicated_misconception", "Conceptual difficulty identified")
                    flag_reason = f"Flagged from quiz answer: {misc_text}"
                    misc_evidence = {
                        "misconception": misc_text,
                        "citation": active_misc[0].get("citation"),
                        "chapter": active_misc[0].get("chapter"),
                        "question_id": active_misc[0].get("question_id"),
                        "flagged_for_review": False,
                    }
                elif incorrect_attempts:
                    flag_reason = f"Flagged from {len(incorrect_attempts)} incorrect response(s) in recent assessments."
                else:
                    flag_reason = f"Assessment score ({mastery_pct}%) is below the 50% foundational threshold."

                c_obj = kb.get_concept(item["quiz_topic"])
                q_item = None
                if c_obj and c_obj.micro_quiz:
                    q = c_obj.micro_quiz[0]
                    q_item = {
                        "id": q.id,
                        "topic": q.topic,
                        "prompt": q.prompt_odia if lang == "or" else q.prompt_english,
                        "options": q.options_odia if lang == "or" else q.options_english,
                        "explanation": q.explanation_odia if lang == "or" else q.explanation_english,
                    }

                weak_concepts.append({
                    "id": cid,
                    "concept_id": full_concept_id,
                    "name": item["name"],
                    "name_odia": item["name_odia"],
                    "chapter": item["chapter"],
                    "subject": item["subject"],
                    "grade": item["grade"],
                    "current_mastery_percent": mastery_pct,
                    "status": "Needs practice",
                    "state": "needs_practice",
                    "flag_reason": flag_reason,
                    "misconception_evidence": misc_evidence,
                    "recommended_activity": {
                        "type": "lesson",
                        "title": f"Revision Lesson: {item['name']}",
                        "concept_id": full_concept_id,
                        "rural_context": item["rural_context"],
                        "reason": item["revision_reason"],
                        "duration_minutes": 10,
                        "has_audio": True,
                    },
                    "retake_quiz": {
                        "available": True,
                        "topic": item["quiz_topic"],
                        "title": f"Retake Quiz: {item['name']}",
                        "questions_count": len(c_obj.micro_quiz) if c_obj else 2,
                        "question": q_item,
                    },
                })

            all_concepts_status.append({
                "id": cid,
                "concept_id": full_concept_id,
                "name": item["name"],
                "chapter": item["chapter"],
                "subject": item["subject"],
                "grade": item["grade"],
                "state": state,
                "status_label": status_label,
                "mastery_percent": mastery_pct if state not in ("not_assessed", "insufficient_data", "needs_review") else None,
                "has_assessment": True,
                "has_misconception": len(active_misc) > 0,
            })

        # Append any unmapped questions flagged for review
        for b in diag_breakdown:
            if b.get("flagged_for_review") or b.get("concept_id") in ("unmapped", "unassigned"):
                all_concepts_status.append({
                    "id": b.get("question_id", "unmapped_q"),
                    "concept_id": "unmapped",
                    "name": f"Assessment Item {b.get('question_id', '')} (Mapping Review)",
                    "chapter": b.get("chapter", "Curriculum Assessment"),
                    "subject": "Science",
                    "grade": profile.get("grade", "Class 9"),
                    "state": "needs_review",
                    "status_label": "Needs Review (Mapping Unavailable)",
                    "mastery_percent": None,
                    "has_assessment": True,
                    "has_misconception": False,
                })

        return {
            "has_assessment_data": True,
            "student_id": user_id,
            "student_grade": profile.get("grade", "Class 9"),
            "weak_concepts_count": len(weak_concepts),
            "weak_concepts": weak_concepts,
            "all_concepts": all_concepts_status,
            "message": (
                f"Detected {len(weak_concepts)} concept(s) that need practice based on your assessment results."
                if weak_concepts
                else "All assessed concepts are on track! No learning gaps detected."
            ),
        }

    async def retake_concept_quiz(
        self,
        user_id: str,
        topic: str,
        question_id: str,
        selected_index: int,
        attempt_id: str | None = None,
    ) -> dict[str, Any]:
        """Processes retake submission, updates mastery atomically, and computes evidence-based progress comparison."""
        db = get_database()
        profile_svc = get_profile_service()
        profile = await profile_svc.get_or_create_profile(user_id)

        # Pre-mastery before this retake
        pre_mastery = profile.get("mastery_graph", {}).get(topic, 0.35)
        if pre_mastery > 1.0:
            pre_mastery = pre_mastery / 100.0

        # Fetch question details
        kb = get_kb_service()
        q_doc = await db.questions.find_one({"id": question_id})
        if not q_doc:
            for item in kb.get_all_seed_questions():
                if item.get("id") == question_id:
                    q_doc = item
                    break

        if not q_doc:
            return {"error": f"Question '{question_id}' not found."}

        correct_index = q_doc.get("correct_index", 0)
        is_correct = selected_index == correct_index

        # Calculate new mastery with real delta
        if is_correct:
            delta = 0.20  # Successful retake increases mastery
            new_mastery = min(1.0, round(pre_mastery + delta, 2))
        else:
            delta = -0.05
            new_mastery = max(0.15, round(pre_mastery + delta, 2))

        # Update Mongo profile
        now = datetime.now(UTC)
        await db.profiles.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    f"mastery_graph.{topic}": new_mastery,
                    "updated_at": now,
                },
                "$inc": {f"evidence_count.{topic}": 1},
            },
        )

        # If correct, resolve any active misconceptions for this topic
        if is_correct:
            await db.profiles.update_one(
                {"user_id": user_id, "misconceptions.concept_id": topic},
                {"$set": {"misconceptions.$.resolved": True, "misconceptions.$.resolved_at": now.isoformat()}},
            )

        # Record retake attempt
        attempt_record = {
            "user_id": user_id,
            "question_id": question_id,
            "attempt_id": attempt_id or f"retake_{int(now.timestamp())}",
            "topic": topic,
            "selected_index": selected_index,
            "correct_index": correct_index,
            "is_correct": is_correct,
            "pre_mastery": pre_mastery,
            "post_mastery": new_mastery,
            "created_at": now,
        }
        await db.quiz_attempts.insert_one(attempt_record)

        # Evidence-based comparison message
        pre_pct = round(pre_mastery * 100)
        post_pct = round(new_mastery * 100)

        if is_correct and post_pct > pre_pct:
            comparison_status = "improved"
            comparison_message = f"Performance improved! Mastery increased from {pre_pct}% to {post_pct}%."
        elif is_correct and post_pct == pre_pct:
            comparison_status = "unchanged"
            comparison_message = f"Performance solid at {post_pct}%. Keep practicing."
        else:
            comparison_status = "needs_practice"
            comparison_message = f"Answer was incorrect. Mastery is {post_pct}%. Review the recommended revision lesson before retrying."

        return {
            "success": True,
            "is_correct": is_correct,
            "selected_index": selected_index,
            "correct_index": correct_index,
            "pre_mastery_percent": pre_pct,
            "post_mastery_percent": post_pct,
            "comparison_status": comparison_status,
            "comparison_message": comparison_message,
            "explanation_odia": q_doc.get("explanation_odia", ""),
            "explanation_english": q_doc.get("explanation_english", ""),
            "new_state": "mastered" if new_mastery >= 0.80 else ("in_progress" if new_mastery >= 0.50 else "needs_practice"),
        }

    def get_question_for_topic(self, topic: str, lang: str = "en") -> dict[str, Any]:
        """Returns a verified micro-quiz question for a given concept topic."""
        kb = get_kb_service()
        c_obj = kb.get_concept(topic)
        if not c_obj or not c_obj.micro_quiz:
            return {"error": f"No quiz question available for topic '{topic}'."}

        q = c_obj.micro_quiz[0]
        return {
            "id": q.id,
            "topic": q.topic,
            "prompt": q.prompt_odia if lang == "or" else q.prompt_english,
            "options": q.options_odia if lang == "or" else q.options_english,
            "explanation": q.explanation_odia if lang == "or" else q.explanation_english,
        }


learning_gap_service = LearningGapService()


def get_learning_gap_service() -> LearningGapService:
    return learning_gap_service
