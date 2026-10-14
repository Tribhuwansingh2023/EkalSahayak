"""Curriculum Knowledge Base Service.

Loads, strictly validates curriculum JSON at startup, and provides:
- Scored topic routing (token overlap over Odia + English + transliterated keywords)
- Safe fallback to 'unknown' topic (never defaults silently to evaporation)
- Scoped misconception diagnosis (only for current topic with trigger keyword match)
- Startup validation that all quiz topics have full KB entries
"""

import json
import logging
import os
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger("ekalsahayak.kb")

REQUIRED_QUIZ_TOPICS = [
    "evaporation",
    "latent_heat",
    "cell_biology",
    "mitochondria",
    "motion",
    "force",
]


class MisconceptionSchema(BaseModel):
    id: str
    text_odia: str
    text_english: str
    trigger_keywords: list[str]


class MicroQuizItemSchema(BaseModel):
    id: str
    topic: str
    difficulty: str
    prompt_odia: str
    prompt_english: str
    options_odia: list[str]
    options_english: list[str]
    correct_index: int
    explanation_odia: str
    explanation_english: str


class CurriculumConceptSchema(BaseModel):
    concept_id: str
    topic: str
    chapter: str
    title_odia: str
    title_english: str
    prerequisites: list[str]
    trigger_keywords: list[str]
    misconceptions: list[MisconceptionSchema]
    analogy_odia: str
    analogy_english: str
    audio_script_odia: str
    audio_script_english: str
    micro_quiz: list[MicroQuizItemSchema]


class KBService:
    """Singleton service managing curriculum data and topic routing."""

    def __init__(self):
        self._curriculum: dict[str, CurriculumConceptSchema] = {}
        self._all_questions: list[dict[str, Any]] = []

    def load_kb(self, file_path: str | None = None) -> None:
        """Loads and validates curriculum JSON data."""
        if file_path is None:
            base_dir = os.path.dirname(os.path.dirname(__file__))
            file_path = os.path.join(base_dir, "kb", "curriculum.json")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Curriculum JSON file not found at: {file_path}")

        with open(file_path, encoding="utf-8") as f:
            raw_data = json.load(f)

        parsed_kb: dict[str, CurriculumConceptSchema] = {}
        all_qs: list[dict[str, Any]] = []

        for topic_key, concept_data in raw_data.items():
            concept = CurriculumConceptSchema(**concept_data)
            parsed_kb[topic_key] = concept
            for q in concept.micro_quiz:
                all_qs.append(q.model_dump())

        # Verify startup requirement: every quiz topic must have a KB entry
        for req_topic in REQUIRED_QUIZ_TOPICS:
            if req_topic not in parsed_kb:
                raise ValueError(
                    f"Startup validation failed: required quiz topic '{req_topic}' is missing from curriculum KB!"
                )
            if len(parsed_kb[req_topic].micro_quiz) < 2:
                raise ValueError(
                    f"Startup validation failed: topic '{req_topic}' must have at least 2 micro-quiz items."
                )

        self._curriculum = parsed_kb
        self._all_questions = all_qs
        logger.info(
            "Curriculum KB loaded successfully with %d concepts and %d seed questions.",
            len(self._curriculum),
            len(self._all_questions),
        )

    def get_concept(self, topic: str) -> CurriculumConceptSchema | None:
        """Retrieves a concept by topic name."""
        return self._curriculum.get(topic)

    def get_all_concepts(self) -> dict[str, CurriculumConceptSchema]:
        return self._curriculum

    def get_all_seed_questions(self) -> list[dict[str, Any]]:
        return self._all_questions

    def score_query_match(self, query: str, concept: CurriculumConceptSchema) -> float:
        """Calculates token overlap score between query and concept trigger keywords."""
        if not query:
            return 0.0

        query_clean = query.lower()
        # Tokenize query by whitespace and common punctuation
        tokens = set(query_clean.replace("?", " ").replace("!", " ").replace(".", " ").replace(",", " ").split())
        if not tokens:
            return 0.0

        score = 0.0
        # 1. Exact phrase/keyword match
        for kw in concept.trigger_keywords:
            kw_clean = kw.lower()
            if kw_clean in query_clean:
                # Longer keywords give higher confidence
                score += 2.0 + (0.2 * len(kw_clean.split()))

        # 2. Token overlap
        for kw in concept.trigger_keywords:
            kw_tokens = set(kw.lower().split())
            overlap = tokens.intersection(kw_tokens)
            score += 1.0 * len(overlap)

        return score

    def route_query_to_topic(self, query: str, threshold: float = 1.5) -> tuple[str, float]:
        """Routes a student query to a topic using scored token overlap.

        Returns (topic, score). If score < threshold, returns ('unknown', score).
        NEVER defaults silently to evaporation!
        """
        if not query or not query.strip():
            return "unknown", 0.0

        best_topic = "unknown"
        best_score = 0.0

        for topic_key, concept in self._curriculum.items():
            match_score = self.score_query_match(query, concept)
            if match_score > best_score:
                best_score = match_score
                best_topic = topic_key

        if best_score < threshold:
            try:
                from app.ml.pedagogical_model import get_class9_agentic_model

                ml_model = get_class9_agentic_model()
                plan = ml_model.plan_interaction(query)
                ml_topic = plan.get("target_topic")
                if ml_topic and ml_topic in self._curriculum and ml_topic != "unknown":
                    logger.info("Semantic ML model routed query '%s' to '%s'", query[:40], ml_topic)
                    return ml_topic, 2.5
            except Exception as e:
                logger.debug("Semantic ML fallback routing exception: %s", e)

            logger.debug(
                "Query '%s' did not meet confidence threshold (score %.2f < %.2f) -> routed to 'unknown'",
                query[:40],
                best_score,
                threshold,
            )
            return "unknown", best_score

        logger.debug("Routed query '%s' to topic '%s' (score %.2f)", query[:40], best_topic, best_score)
        return best_topic, best_score

    def diagnose_misconception(self, query: str, topic: str) -> dict[str, str] | None:
        """Diagnoses misconceptions STRICTLY scoped to the CURRENT topic.

        Checks whether any misconception trigger keywords match the query.
        """
        concept = self.get_concept(topic)
        if not concept or not concept.misconceptions:
            return None

        query_clean = query.lower()
        for misc in concept.misconceptions:
            for trigger in misc.trigger_keywords:
                if trigger.lower() in query_clean:
                    return {
                        "id": misc.id,
                        "text_odia": misc.text_odia,
                        "text_english": misc.text_english,
                    }
        return None


# Global singleton instance
kb_service = KBService()


def get_kb_service() -> KBService:
    return kb_service
