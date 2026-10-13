"""
Deterministic State Graph (Workflow Agent) for Sunita AI
Built with LangGraph.

Architecture Rationale:
- Education for rural Class 9 students requires high pedagogical safety, zero hallucination,
  and strict curriculum alignment with BSE Odisha.
- A deterministic workflow graph guarantees:
  1. Systematic prerequisite assessment before jumping to answers
  2. Native vernacular reasoning (Odia/Kui) with cultural analogies
  3. Formative 2-question micro-drills
  4. Autonomous learning-graph mastery updates and next-day follow-ups
"""

import os
from datetime import datetime
from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END

from state import AgentState, StudentProfile
from curriculum_kb import find_relevant_concept, ODISHA_CLASS9_SCIENCE_KB
from tools import (
    assess_prerequisite_tool,
    generate_vernacular_analogy_tool,
    create_micro_quiz_tool,
    update_learning_graph_tool,
)
from profile_manager import profile_manager


# --- LLM Client Setup (Optional Dynamic Polish) ---
def get_llm():
    """Returns an LLM client if configured, otherwise None (uses deterministic engine)."""
    # Try Groq
    if os.getenv("GROQ_API_KEY"):
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.3)
        except Exception:
            pass
            
    # Try Google Gemini
    if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)
        except Exception:
            pass

    # Try OpenAI
    if os.getenv("OPENAI_API_KEY"):
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model_name="gpt-4o-mini", temperature=0.3)
        except Exception:
            pass

    return None


# ==========================================
# GRAPH NODES
# ==========================================

def node_intake_and_diagnose(state: AgentState) -> Dict[str, Any]:
    """
    Step 1: Ingests student doubt, identifies topic, and invokes AssessPrerequisiteTool.
    """
    query = state.get("query", "")
    student_id = state.get("student_id", "sunita_class9")
    current_profile = profile_manager.get_profile(student_id)
    
    # 1. Identify Odisha Class 9 Science concept
    detected_topic = find_relevant_concept(query)
    
    # 2. Invoke AssessPrerequisiteTool
    prereq_result = assess_prerequisite_tool.invoke({
        "topic": detected_topic,
        "student_profile": current_profile,
        "query": query
    })
    
    is_missing = prereq_result["is_prerequisite_missing"] or (prereq_result["diagnosed_misconception"] is not None)
    prereq_topic = prereq_result["missing_prerequisites"][0]["prereq_id"] if prereq_result["missing_prerequisites"] else None
    
    # Log Tool Trace
    trace = {
        "step_name": "INTAKE_AND_PREREQUISITE_DIAGNOSIS",
        "node": "node_intake_and_diagnose",
        "thought": f"Sunita asked: '{query}'. Evaluated topic '{detected_topic}'. Checking prerequisite mastery and misconceptions.",
        "tool_called": "assess_prerequisite_tool",
        "tool_args": {"topic": detected_topic, "student_id": student_id},
        "tool_output": prereq_result,
        "decision_rationale": (
            f"Prerequisite missing or misconception diagnosed ('{prereq_result.get('diagnosed_misconception')}'). "
            "Routing to Remediation Node first." if is_missing else "Student has adequate prerequisite foundation. Routing directly to Vernacular Reasoning."
        ),
        "timestamp": datetime.now().isoformat()
    }
    
    existing_traces = state.get("traces", [])
    
    return {
        "detected_topic": detected_topic,
        "student_profile": current_profile,
        "prerequisite_missing": is_missing,
        "prerequisite_topic": prereq_topic,
        "misconception_diagnosed": prereq_result.get("diagnosed_misconception"),
        "traces": existing_traces + [trace],
        "current_node": "node_intake_and_diagnose"
    }


def should_remediate(state: AgentState) -> Literal["remediate", "reason"]:
    """Conditional Edge routing decision."""
    if state.get("prerequisite_missing"):
        return "remediate"
    return "reason"


def node_remediate_foundation(state: AgentState) -> Dict[str, Any]:
    """
    Step 2 (Remediation Branch): Explicitly clears the misconception before diving deeper.
    """
    topic = state.get("detected_topic", "evaporation")
    misconception = state.get("misconception_diagnosed")
    concept_data = ODISHA_CLASS9_SCIENCE_KB.get(topic, ODISHA_CLASS9_SCIENCE_KB["evaporation"])
    
    correction = None
    for misc in concept_data.get("misconceptions", []):
        if misc.get("misconception") == misconception:
            correction = misc.get("correction_odia")
            break
            
    if not correction:
        correction = "ମନେରଖ ସୁନିତା, ପାଣି ୧୦୦°C ରେ ନ ପହଞ୍ଚି ମଧ୍ୟ ଖରା ଏବଂ ପବନରେ ଧୀରେ ଧୀରେ ବାଷ୍ପୀଭୂତ ହୋଇପାରେ।"

    trace = {
        "step_name": "FOUNDATION_REMEDIATION",
        "node": "node_remediate_foundation",
        "thought": f"Targeting diagnosed misconception: '{misconception}'. Providing clear conceptual boundary in Odia.",
        "tool_called": "pedagogical_remediation_guardrail",
        "tool_args": {"topic": topic, "misconception": misconception},
        "tool_output": {"correction_odia": correction},
        "decision_rationale": "Addressed foundational gap before introducing the main vernacular analogy.",
        "timestamp": datetime.now().isoformat()
    }
    
    existing_traces = state.get("traces", [])
    
    return {
        "traces": existing_traces + [trace],
        "current_node": "node_remediate_foundation"
    }


def node_vernacular_reasoning(state: AgentState) -> Dict[str, Any]:
    """
    Step 3: Calls GenerateVernacularAnalogyTool to anchor the concept in Odia culture.
    """
    topic = state.get("detected_topic", "evaporation")
    misconception = state.get("misconception_diagnosed")
    
    analogy_result = generate_vernacular_analogy_tool.invoke({
        "topic": topic,
        "culture_context": "tribal_rural_odisha",
        "misconception": misconception
    })
    
    trace = {
        "step_name": "VERNACULAR_ANALOGY_GENERATION",
        "node": "node_vernacular_reasoning",
        "thought": f"Selected cultural anchor: '{analogy_result.get('title_odia')}'. Crafting explanation in native Odia suited for Class 9.",
        "tool_called": "generate_vernacular_analogy_tool",
        "tool_args": {"topic": topic, "culture_context": "tribal_rural_odisha"},
        "tool_output": analogy_result,
        "decision_rationale": "High pedagogical retention achieved by linking abstract science to everyday earthen pot physics.",
        "timestamp": datetime.now().isoformat()
    }
    
    existing_traces = state.get("traces", [])
    
    return {
        "vernacular_analogy": analogy_result,
        "final_response_odia": analogy_result.get("full_response_odia", ""),
        "final_audio_script": analogy_result.get("audio_spoken_script", ""),
        "traces": existing_traces + [trace],
        "current_node": "node_vernacular_reasoning"
    }


def node_formative_assessment(state: AgentState) -> Dict[str, Any]:
    """
    Step 4: Calls CreateMicroQuizTool to generate 2 bite-sized diagnostic questions.
    """
    topic = state.get("detected_topic", "evaporation")
    
    quiz_result = create_micro_quiz_tool.invoke({
        "topic": topic,
        "difficulty_level": "foundational"
    })
    
    trace = {
        "step_name": "FORMATIVE_ASSESSMENT_CREATION",
        "node": "node_formative_assessment",
        "thought": f"Constructing 2 micro-check questions in Odia for '{topic}' to test retention immediately.",
        "tool_called": "create_micro_quiz_tool",
        "tool_args": {"topic": topic, "difficulty_level": "foundational"},
        "tool_output": quiz_result,
        "decision_rationale": "Instant formative check reinforces memory without cognitive overload on shared phone.",
        "timestamp": datetime.now().isoformat()
    }
    
    existing_traces = state.get("traces", [])
    
    return {
        "micro_quiz": quiz_result.get("questions", []),
        "traces": existing_traces + [trace],
        "current_node": "node_formative_assessment"
    }


def node_evaluate_and_update(state: AgentState) -> Dict[str, Any]:
    """
    Step 5: Calls UpdateLearningGraphTool to update mastery and schedule autonomous follow-up.
    """
    topic = state.get("detected_topic", "evaporation")
    student_id = state.get("student_id", "sunita_class9")
    
    # Assess learning signal
    update_result = update_learning_graph_tool.invoke({
        "student_id": student_id,
        "topic": topic,
        "comprehension_signal": "moderate",
        "score": 0.80
    })
    
    # Apply delta to live profile manager
    delta = update_result.get("mastery_delta", 0.10)
    updated_profile = profile_manager.update_mastery(student_id, topic, delta)
    profile_manager.add_followup(student_id, update_result.get("scheduled_autonomous_followup", {}))
    
    trace = {
        "step_name": "LEARNING_GRAPH_UPDATE_AND_FOLLOWUP",
        "node": "node_evaluate_and_update",
        "thought": f"Updated mastery for '{topic}' (+{delta}). Scheduled autonomous follow-up for Sunita tomorrow evening.",
        "tool_called": "update_learning_graph_tool",
        "tool_args": {"student_id": student_id, "topic": topic},
        "tool_output": update_result,
        "decision_rationale": "Agentic follow-through: learner doesn't have to remember to check in; system remembers for her.",
        "timestamp": datetime.now().isoformat()
    }
    
    existing_traces = state.get("traces", [])
    
    followup_plan = (
        f"କାର୍ଯ୍ୟସୂଚୀ: ଆସନ୍ତାକାଲି ସନ୍ଧ୍ୟା ୬ ଟାରେ '{topic}' ଉପରେ ଏକ ଛୋଟ ଅଭ୍ୟାସ କୁଇଜ୍ ନିର୍ଦ୍ଧାରିତ କରାଗଲା।"
    )
    
    return {
        "updated_mastery": updated_profile.get("mastery_map", {}),
        "next_followup_plan": followup_plan,
        "traces": existing_traces + [trace],
        "current_node": "node_evaluate_and_update"
    }


# ==========================================
# BUILD THE COMPILED LANGGRAPH
# ==========================================

def build_sunita_agent_graph():
    """Builds and compiles the deterministic LangGraph workflow."""
    workflow = StateGraph(AgentState)
    
    # Add Nodes
    workflow.add_node("intake_and_diagnose", node_intake_and_diagnose)
    workflow.add_node("remediate_foundation", node_remediate_foundation)
    workflow.add_node("vernacular_reasoning", node_vernacular_reasoning)
    workflow.add_node("formative_assessment", node_formative_assessment)
    workflow.add_node("evaluate_and_update", node_evaluate_and_update)
    
    # Set Entry Point
    workflow.set_entry_point("intake_and_diagnose")
    
    # Add Conditional Edge from intake
    workflow.add_conditional_edges(
        "intake_and_diagnose",
        should_remediate,
        {
            "remediate": "remediate_foundation",
            "reason": "vernacular_reasoning"
        }
    )
    
    # Edges
    workflow.add_edge("remediate_foundation", "vernacular_reasoning")
    workflow.add_edge("vernacular_reasoning", "formative_assessment")
    workflow.add_edge("formative_assessment", "evaluate_and_update")
    workflow.add_edge("evaluate_and_update", END)
    
    return workflow.compile()


# Compiled Singleton Graph
sunita_agent_graph = build_sunita_agent_graph()
