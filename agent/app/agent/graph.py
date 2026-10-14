from typing import Any

from langgraph.graph import END, StateGraph

from app.agent.nodes import (
    node_clarify_or_escalate,
    node_evaluate_and_update,
    node_formative_assessment,
    node_intake_and_diagnose,
    node_remediate_foundation,
    node_vernacular_reasoning,
)
from app.agent.state import AgentState


def route_after_intake(state: AgentState) -> str:
    """Routing logic after intake: clarification vs prerequisite vs reasoning."""
    if state.get("is_clarification", False):
        return "clarify_or_escalate"
    if state.get("prerequisite_missing", False):
        return "remediate_foundation"
    return "vernacular_reasoning"


def build_lakshya_agent_graph() -> Any:
    """Builds and compiles the pedagogical StateGraph."""
    workflow = StateGraph(AgentState)

    # 1. Register Nodes
    workflow.add_node("intake_and_diagnose", node_intake_and_diagnose)
    workflow.add_node("clarify_or_escalate", node_clarify_or_escalate)
    workflow.add_node("remediate_foundation", node_remediate_foundation)
    workflow.add_node("vernacular_reasoning", node_vernacular_reasoning)
    workflow.add_node("formative_assessment", node_formative_assessment)
    workflow.add_node("evaluate_and_update", node_evaluate_and_update)

    # 2. Entry Point
    workflow.set_entry_point("intake_and_diagnose")

    # 3. Conditional Branch from Intake
    workflow.add_conditional_edges(
        "intake_and_diagnose",
        route_after_intake,
        {
            "clarify_or_escalate": "clarify_or_escalate",
            "remediate_foundation": "remediate_foundation",
            "vernacular_reasoning": "vernacular_reasoning",
        },
    )

    # 4. Transitions
    workflow.add_edge("clarify_or_escalate", END)
    workflow.add_edge("remediate_foundation", "vernacular_reasoning")
    workflow.add_edge("vernacular_reasoning", "formative_assessment")
    workflow.add_edge("formative_assessment", "evaluate_and_update")
    workflow.add_edge("evaluate_and_update", END)

    return workflow.compile()


# Compiled Singleton Graph
lakshya_agent_graph = build_lakshya_agent_graph()
