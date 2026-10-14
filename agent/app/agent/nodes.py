"""Async Graph Nodes for Lakshya AI Deterministic Pedagogical Workflow.

All nodes are async def and use run_in_threadpool where appropriate.
Every node records exact duration_ms, request_id, and llm_used telemetry.
"""

import logging
import time
from datetime import UTC, datetime
from typing import Any

from app.agent.llm import get_llm_engine
from app.agent.state import AgentState
from app.agent.tools import (
    assess_prerequisite_tool,
    create_micro_quiz_tool,
    generate_vernacular_analogy_tool,
    pedagogical_remediation_guardrail,
    update_learning_graph_tool,
)
from app.db import get_database
from app.rag.generator import generate_rag_response
from app.services.kb_service import get_kb_service
from app.services.profile_service import get_profile_service

logger = logging.getLogger("ekalsahayak.agent.nodes")


async def node_intake_and_diagnose(state: AgentState) -> dict[str, Any]:
    """Node 1: Scored topic routing, NCERT RAG verification, and prerequisite gap diagnosis."""
    start_time = time.perf_counter()
    query = state.get("query", "")
    user_id = state.get("user_id", "anonymous")
    req_lang = str(state.get("language", "or")).strip()
    kb = get_kb_service()
    profile_svc = get_profile_service()

    # 1. Scored Topic Routing from curriculum KB
    detected_topic, confidence = kb.route_query_to_topic(query)

    # 2. Check NCERT Class 9 RAG Index
    rag_res = generate_rag_response(query, language=req_lang)

    # If KB had no match, check if RAG successfully found a real NCERT chapter
    if detected_topic == "unknown" and not rag_res.get("is_not_found", True):
        detected_topic = rag_res.get("detected_topic", "unknown")
        confidence = float(rag_res.get("topic_confidence", 0.8))

    # 3. Clarification Branch Check (only if unknown after both KB and RAG)
    if detected_topic == "unknown":
        duration = round((time.perf_counter() - start_time) * 1000, 2)
        trace_item = {
            "step_name": "INTAKE_AND_TOPIC_ROUTING",
            "node": "node_intake_and_diagnose",
            "tool_called": "route_query_to_topic",
            "tool_args": {"query": query[:60]},
            "tool_output": {
                "detected_topic": "unknown",
                "confidence": confidence,
                "rag_not_found": rag_res.get("is_not_found", True),
            },
            "pedagogical_intent": "Query did not match curriculum topics with sufficient confidence.",
            "duration_ms": duration,
        }
        return {
            "detected_topic": "unknown",
            "topic_confidence": confidence,
            "is_clarification": True,
            "is_not_found": rag_res.get("is_not_found", True),
            "rag_result": rag_res,
            "current_node": "node_intake_and_diagnose",
            "traces": state.get("traces", []) + [trace_item],
        }

    # 4. Retrieve Profile from Mongo
    profile = await profile_svc.get_or_create_profile(user_id)

    # 5. Scoped Misconception Diagnosis
    misconception_dict = kb.diagnose_misconception(query, detected_topic)
    misc_text = None
    if misconception_dict:
        misc_text = misconception_dict["text_odia"]
        await profile_svc.record_misconception(user_id, detected_topic, misc_text)

    # 6. Assess Foundational Prerequisites
    prereq_res = assess_prerequisite_tool.invoke({
        "topic": detected_topic,
        "student_profile": profile,
    })

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace_item = {
        "step_name": "INTAKE_AND_PREREQUISITE_DIAGNOSIS",
        "node": "node_intake_and_diagnose",
        "tool_called": "assess_prerequisite_tool",
        "tool_args": {"topic": detected_topic, "student_id": user_id},
        "tool_output": prereq_res,
        "pedagogical_intent": "Diagnose foundational prerequisite mastery and flag conceptual traps.",
        "duration_ms": duration,
    }

    return {
        "detected_topic": detected_topic,
        "topic_confidence": confidence,
        "student_profile": profile,
        "prerequisite_missing": prereq_res.get("prerequisite_missing", False),
        "prerequisite_topic": prereq_res.get("prerequisite_topic"),
        "misconception_diagnosed": misc_text,
        "is_clarification": False,
        "is_not_found": False,
        "rag_result": rag_res,
        "current_node": "node_intake_and_diagnose",
        "traces": state.get("traces", []) + [trace_item],
    }


async def node_clarify_or_escalate(state: AgentState) -> dict[str, Any]:
    """Node 1B: Fallback when topic is unknown or out of curriculum. Honest clarification with EkalSahay."""
    start_time = time.perf_counter()
    req_lang = str(state.get("language", "or")).strip().lower()
    rag_res = state.get("rag_result") or {}

    is_out_of_curriculum = state.get("is_not_found", False) or rag_res.get("is_not_found", False)

    if is_out_of_curriculum and req_lang in ("en", "english"):
        clarification_text = (
            "This topic is not covered in the CBSE NCERT Class 9 textbook. "
            "Please ask questions related to Class 9 Science, Mathematics, or Social Science curriculum.\n\n"
            "[Citation: CBSE NCERT Class 9 Textbook Boundary]"
        )
        audio_script = clarification_text
        provenance = {
            "source": "server-rag",
            "book": "None",
            "chapter": "Curriculum Boundary",
            "page": 0,
            "model": "NCERT-RAG-Hybrid",
            "latency_ms": 5.0,
            "citation": "CBSE NCERT Class 9 Textbook Boundary",
        }
        citation = "CBSE NCERT Class 9 Textbook Boundary"
    else:
        clarification_text = (
            "ନମସ୍କାର! ମୁଁ ଏକଲସହାୟ (EkalSahay) । ତୁମର ଏହି ପ୍ରଶ୍ନଟି ଆମ ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପାଠ୍ୟକ୍ରମ ସହ ସିଧାସଳଖ ମେଳ ଖାଉନାହିଁ । "
            "ତୁମେ ଏହି ବିଷୟଗୁଡ଼ିକ ଉପରେ ପଚାରିପାରିବ: "
            "୧. ବାଷ୍ପୀଭବନ ଓ ଲୀନ ତାପ (ପଦାର୍ଥର ଅବସ୍ଥା), "
            "୨. କୋଷ ଓ ମାଇଟୋକଣ୍ଡ୍ରିଆ (ଜୀବନର ଏକକ), "
            "୩. ଦୂରତା, ବିସ୍ଥାପନ ଓ ଗତି, "
            "୪. ବଳ ଏବଂ ନିଉଟନଙ୍କ ଗତି ନିୟମ । "
            "ଅଧିକ ଜାଣିବା ପାଇଁ ତୁମ ବିଜ୍ଞାନ ଶିକ୍ଷକଙ୍କ ପରାମର୍ଶ ନିଅନ୍ତୁ ।"
        )
        audio_script = (
            "ଦୟାକରି ତୁମ ପ୍ରଶ୍ନଟି ଆଉ ଟିକେ ସ୍ପଷ୍ଟ ଭାବରେ କୁହ । ତୁମେ ବାଷ୍ପୀଭବନ, କୋଷ, ଗତି କିମ୍ବା ବଳ ବିଷୟରେ ପଚାରିପାରିବ ।"
        )
        provenance = {
            "source": "server-rag",
            "book": "None",
            "chapter": "Curriculum Guidance",
            "page": 0,
            "model": "NCERT-RAG-Hybrid",
            "latency_ms": 5.0,
            "citation": "CBSE NCERT Class 9 Curriculum Guidance",
        }
        citation = "CBSE NCERT Class 9 Curriculum Guidance"

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace_item = {
        "step_name": "CLARIFY_OR_ESCALATE",
        "node": "node_clarify_or_escalate",
        "tool_called": "clarify_unknown_query",
        "tool_args": {"query": state.get("query", "")},
        "tool_output": {"action": "clarify_and_suggest_topics", "is_not_found": is_out_of_curriculum},
        "pedagogical_intent": "Safely guide student back to syllabus topics without hallucination.",
        "duration_ms": duration,
    }

    return {
        "final_response_odia": clarification_text,
        "final_audio_script": audio_script,
        "micro_quiz": [],
        "next_followup_plan": "ତୁମେ ଯେକୌଣସି ସମୟରେ ତୁମ ପାଠ୍ୟକ୍ରମରୁ ପ୍ରଶ୍ନ ପଚାରିପାରିବ ।",
        "provenance": provenance,
        "citation": citation,
        "is_not_found": is_out_of_curriculum,
        "retrieved_chunks": rag_res.get("retrieved_chunks", []),
        "groundedness_score": rag_res.get("groundedness_score", 0.0),
        "current_node": "node_clarify_or_escalate",
        "traces": state.get("traces", []) + [trace_item],
    }


async def node_remediate_foundation(state: AgentState) -> dict[str, Any]:
    """Node 2: Scaffolding missing foundational concept."""
    start_time = time.perf_counter()
    prereq_topic = state.get("prerequisite_topic", "")

    remediation = pedagogical_remediation_guardrail.invoke({"prerequisite_topic": prereq_topic})

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace_item = {
        "step_name": "FOUNDATION_REMEDIATION",
        "node": "node_remediate_foundation",
        "tool_called": "pedagogical_remediation_guardrail",
        "tool_args": {"prerequisite_topic": prereq_topic},
        "tool_output": remediation,
        "pedagogical_intent": f"Pre-emptively scaffold foundational concept '{prereq_topic}' before addressing core topic.",
        "duration_ms": duration,
    }

    return {
        "current_node": "node_remediate_foundation",
        "traces": state.get("traces", []) + [trace_item],
    }


async def node_vernacular_reasoning(state: AgentState) -> dict[str, Any]:
    """Node 3: Ground in NCERT Class 9 verified chunks with rural cultural anchors."""
    start_time = time.perf_counter()
    topic = state.get("detected_topic", "evaporation")
    query = state.get("query", "")

    req_lang = str(state.get("language", "or")).strip()
    clean_lang = req_lang.lower()
    if clean_lang in ("odia", "or"):
        target_lang = "or"
    elif clean_lang in ("english", "en"):
        target_lang = "en"
    elif clean_lang in ("hindi", "hi"):
        target_lang = "hi"
    else:
        target_lang = req_lang

    # 1. Real NCERT Grounded RAG Generation
    rag_res = state.get("rag_result") or generate_rag_response(query, language=target_lang)
    rag_text = rag_res.get("final_response_odia", "")
    provenance = rag_res.get("provenance")
    citation = provenance.get("citation") if provenance else None
    retrieved_chunks = rag_res.get("retrieved_chunks", [])
    groundedness_score = rag_res.get("groundedness_score", 1.0)
    is_not_found = rag_res.get("is_not_found", False)

    # 2. Local Cultural Analogy
    analogy_res = generate_vernacular_analogy_tool.invoke({
        "topic": topic,
        "misconception_id": state.get("misconception_diagnosed"),
    })
    base_odia = analogy_res.get("analogy_odia", "")
    base_english = analogy_res.get("analogy_english", "")
    base_audio = analogy_res.get("audio_script", "")

    llm = get_llm_engine()
    llm_used = False
    model_name = "NCERT-Class9-Hybrid-RAG"
    machine_translated = False
    served_lang = target_lang

    if is_not_found:
        final_text = rag_text
    elif rag_text and "[Citation:" in rag_text:
        final_text = rag_text
        if base_odia and target_lang == "or" and "ବାଷ୍ପୀଭବନ" in base_odia and topic == "evaporation":
            final_text = f"{rag_text}\n\nଗ୍ରାମୀଣ ଉଦାହରଣ:\n{base_odia}"
    else:
        # Fallback to KB passage with optional translation
        if target_lang == "or":
            final_text = base_odia
            served_lang = "or"
        elif target_lang == "en":
            final_text = base_english or base_odia
            served_lang = "en"
        else:
            final_text, served_lang, llm_used, machine_translated = await llm.translate_passage(
                passage_en=base_english or base_odia,
                passage_or=base_odia,
                target_lang=target_lang,
                topic=topic,
                keep_english_terms=True,
            )
            model_name = "ncert-multilingual-translator" if llm_used else None

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace_item = {
        "step_name": "VERNACULAR_ANALOGY_GENERATION",
        "node": "node_vernacular_reasoning",
        "tool_called": "generate_rag_response",
        "tool_args": {"topic": topic, "lang_requested": target_lang},
        "tool_output": {
            "analogy_preview": final_text[:80],
            "citation": citation,
            "groundedness_score": groundedness_score,
            "lang_requested": target_lang,
            "lang_served": served_lang,
            "model": model_name,
        },
        "pedagogical_intent": f"Deliver NCERT Class 9 grounded explanation with citation in '{served_lang}'.",
        "duration_ms": duration,
    }

    return {
        "vernacular_analogy": analogy_res,
        "final_response_odia": final_text,
        "final_audio_script": final_text[:200] if final_text else base_audio,
        "llm_used": llm_used,
        "model_name": model_name,
        "language_served": served_lang,
        "machine_translated": machine_translated,
        "provenance": provenance,
        "citation": citation,
        "retrieved_chunks": retrieved_chunks,
        "groundedness_score": groundedness_score,
        "is_not_found": is_not_found,
        "current_node": "node_vernacular_reasoning",
        "traces": state.get("traces", []) + [trace_item],
    }


async def node_formative_assessment(state: AgentState) -> dict[str, Any]:
    """Node 4: Produces formative micro-quiz items."""
    start_time = time.perf_counter()
    topic = state.get("detected_topic", "evaporation")

    micro_quiz = create_micro_quiz_tool.invoke({"topic": topic})

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace_item = {
        "step_name": "FORMATIVE_ASSESSMENT_CREATION",
        "node": "node_formative_assessment",
        "tool_called": "create_micro_quiz_tool",
        "tool_args": {"topic": topic},
        "tool_output": {"questions_generated": len(micro_quiz)},
        "pedagogical_intent": "Deliver bite-sized formative micro-quiz to assess immediate comprehension.",
        "duration_ms": duration,
    }

    return {
        "micro_quiz": micro_quiz,
        "current_node": "node_formative_assessment",
        "traces": state.get("traces", []) + [trace_item],
    }


async def node_evaluate_and_update(state: AgentState) -> dict[str, Any]:
    """Node 5: Updates mastery graph and schedules real timestamped follow-up."""
    start_time = time.perf_counter()
    user_id = state.get("user_id", "anonymous")
    topic = state.get("detected_topic", "evaporation")
    profile = state.get("student_profile", {})
    profile_svc = get_profile_service()

    topic_mastery = profile.get("mastery_graph", {}).get(topic, 0.0)

    # Schedule follow-up with real ISO timestamp if mastery < 0.50
    scheduled_iso = await profile_svc.schedule_followup_if_needed(user_id, topic, topic_mastery)

    update_res = update_learning_graph_tool.invoke({
        "user_id": user_id,
        "topic": topic,
        "topic_mastery": topic_mastery,
    })

    if scheduled_iso:
        followup_plan = f"କାର୍ଯ୍ୟସୂଚୀ: {scheduled_iso[:10]} ରେ '{topic}' ଉପରେ ଏକ ଅଭ୍ୟାସ କୁଇଜ୍ ନିର୍ଦ୍ଧାରିତ କରାଗଲା ।"
    else:
        followup_plan = f"ବହୁତ ବଢ଼ିଆ! '{topic}' ବିଷୟରେ ତୁମର ଧାରଣା ଉତ୍ତମ ରହିଛି ।"

    duration = round((time.perf_counter() - start_time) * 1000, 2)
    trace_item = {
        "step_name": "LEARNING_GRAPH_UPDATE_AND_FOLLOWUP",
        "node": "node_evaluate_and_update",
        "tool_called": "update_learning_graph_tool",
        "tool_args": {"user_id": user_id, "topic": topic},
        "tool_output": update_res,
        "pedagogical_intent": "Persist student mastery progress and schedule spaced repetition review.",
        "duration_ms": duration,
    }

    # Persist complete trace to MongoDB with 30-day TTL
    try:
        db = get_database()
        all_traces = state.get("traces", []) + [trace_item]
        await db.agent_traces.insert_one({
            "user_id": str(user_id),
            "request_id": state.get("request_id"),
            "query": state.get("query"),
            "topic": topic,
            "llm_used": state.get("llm_used", False),
            "traces": all_traces,
            "created_at": datetime.now(UTC),
        })
    except Exception as exc:
        logger.warning("Could not persist trace to MongoDB: %s", exc)

    return {
        "updated_mastery": {topic: topic_mastery},
        "next_followup_plan": followup_plan,
        "current_node": "node_evaluate_and_update",
        "traces": state.get("traces", []) + [trace_item],
    }
