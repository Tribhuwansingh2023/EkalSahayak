"""Agent 1: Curriculum RAG Agent (Grounded Retrieval & NCERT Sourcing Specialist).

Retrieves verified pedagogical source chunks from the real NCERT Class 9 corpus,
extracts formal scientific definitions, exact page/chapter citations, and identifies
canonical terminology.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.agent.multiagent.base_agent import AgentRole, AgentTelemetry
from app.rag.retriever import retrieve_ncert_chunks

logger = logging.getLogger("ekalsahayak.multiagent.rag")


class CurriculumRAGAgent:
    """Specialized Agent for factual grounding and NCERT textbook evidence retrieval."""

    def __init__(self, name: str = "NCERT-Curriculum-RAG-Agent") -> None:
        self.name = name
        self.role = AgentRole.CURRICULUM_RAG

    def _extract_canonical_definition(self, text: str) -> str:
        """Extracts formal textbook definition or law from raw passage text."""
        # Check for colon definitions or quotes
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 15]
        for s in sentences:
            s_lower = s.lower()
            if any(marker in s_lower for marker in [
                "law of motion:", "first law of motion", "is defined as", "is called",
                "process in which", "an object continues", "continues to be in a state",
                "matter is composed", "energy can neither be created", "force is",
                "inertia is", "evaporation is", "latent heat is"
            ]):
                return s
        return sentences[0] if sentences else text[:200]

    def _extract_scientific_terms(self, text: str) -> list[str]:
        """Extracts bolded or key scientific vocabulary from excerpt."""
        scientific_vocab = [
            "inertia", "force", "acceleration", "velocity", "momentum", "mass", "weight",
            "evaporation", "latent heat", "boiling point", "melting point", "sublimation",
            "atom", "molecule", "electron", "proton", "neutron", "valency", "isotope",
            "cell", "mitochondria", "plastid", "chloroplast", "osmosis", "diffusion",
            "tissue", "xylem", "phloem", "parenchyma", "gravitation", "work", "kinetic energy",
            "potential energy", "frequency", "amplitude", "wavelength", "ultrasound"
        ]
        text_lower = text.lower()
        found = [term for term in scientific_vocab if term in text_lower]
        return found[:6]

    async def execute(
        self,
        query: str,
        shared_state: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> tuple[dict[str, Any], AgentTelemetry]:
        """Searches real NCERT index and constructs grounded knowledge evidence."""
        telemetry = AgentTelemetry(
            agent_id=self.name,
            role=self.role,
            step_name="RETRIEVE_NCERT_GROUNDING",
            input_summary=query[:100],
            model_used="hybrid-sparse-dense-ncert-v2",
        )

        try:
            chunks, latency_ms = retrieve_ncert_chunks(query=query, top_k=3, min_score=0.08)

            if not chunks:
                artifact = {
                    "is_grounded": False,
                    "is_out_of_curriculum": True,
                    "chapter": "Unknown / Out of Syllabus",
                    "citation": "No matching NCERT Class 9 chapter found",
                    "verbatim_excerpt": "",
                    "definition": "",
                    "key_terms": [],
                    "retrieved_chunks": [],
                    "confidence": 0.20,
                }
                telemetry.finish(
                    confidence=0.20,
                    rationale="Query did not match any NCERT Class 9 Science chapters with sufficient semantic similarity.",
                    artifacts=artifact,
                )
                return artifact, telemetry

            top_chunk = chunks[0]
            chapter_name = top_chunk.get("chapter", "NCERT Class 9 Science")
            citation = top_chunk.get("citation", f"NCERT Class 9 Science, {chapter_name}")
            raw_text = top_chunk.get("text", "")
            score = float(top_chunk.get("score", 0.85))

            # Content word hit verification against retrieved text
            content_words = [
                w.lower() for w in re.findall(r"\b[a-zA-Z]{3,}\b", query)
                if w.lower() not in {"what", "how", "why", "when", "the", "and", "explain", "does", "are"}
            ]
            top_text_corpus = (raw_text + " " + chapter_name).lower()
            content_hit = any(w in top_text_corpus for w in content_words) if content_words else True

            if not content_hit or score < 0.20:
                artifact = {
                    "is_grounded": False,
                    "is_out_of_curriculum": True,
                    "chapter": "Out of Curriculum",
                    "citation": "NCERT Class 9 Textbook Boundary",
                    "verbatim_excerpt": "",
                    "definition": "",
                    "key_terms": [],
                    "retrieved_chunks": [],
                    "confidence": 0.20,
                }
                telemetry.finish(
                    confidence=0.20,
                    rationale="Query content words did not match syllabus topics in retrieved NCERT chapters.",
                    artifacts=artifact,
                )
                return artifact, telemetry

            definition = self._extract_canonical_definition(raw_text)
            key_terms = self._extract_scientific_terms(raw_text)

            artifact = {
                "is_grounded": True,
                "is_out_of_curriculum": False,
                "chapter": chapter_name,
                "citation": citation,
                "verbatim_excerpt": raw_text[:500],
                "definition": definition,
                "key_terms": key_terms,
                "retrieved_chunks": chunks,
                "confidence": min(round(score * 1.5, 3), 0.98),
            }

            telemetry.finish(
                confidence=artifact["confidence"],
                rationale=f"Grounded on {citation} with top similarity score {score:.4f}.",
                artifacts={
                    "chapter": chapter_name,
                    "citation": citation,
                    "key_terms": key_terms,
                    "top_score": score,
                },
            )
            return artifact, telemetry

        except Exception as exc:
            logger.exception("CurriculumRAGAgent failed during retrieval: %s", exc)
            fallback_artifact = {
                "is_grounded": False,
                "is_out_of_curriculum": False,
                "chapter": "NCERT Class 9 Science",
                "citation": "NCERT Class 9 Science Standard Corpus",
                "verbatim_excerpt": "",
                "definition": "Scientific concept under BSE Odisha / NCERT Class 9 syllabus.",
                "key_terms": [],
                "retrieved_chunks": [],
                "confidence": 0.50,
            }
            telemetry.finish(
                confidence=0.50,
                rationale=f"Fallback triggered due to retrieval error: {exc}",
                artifacts=fallback_artifact,
            )
            return fallback_artifact, telemetry
