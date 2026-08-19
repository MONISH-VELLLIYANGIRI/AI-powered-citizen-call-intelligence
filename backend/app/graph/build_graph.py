"""
LangGraph StateGraph construction with conditional edges.
Exposes run_complaint_pipeline() for use by API routers.
"""
from langgraph.graph import StateGraph, END
from app.graph.state import ComplaintState
from app.graph.nodes import (
    intake_node,
    triage_node,
    classify_node,
    duplicate_check_node,
    merge_node,
    emergency_fast_path_node,
    route_department_node,
    summarize_node,
    resolution_planner_node,
)


def _after_classify(state: ComplaintState) -> str:
    """Conditional edge: emergency → fast-path, else → duplicate check."""
    if state.get("urgency") == "emergency":
        return "emergency_fast_path"
    return "duplicate_check"


def _after_duplicate_check(state: ComplaintState) -> str:
    """Conditional edge: duplicate found → merge, else → route."""
    if state.get("is_duplicate"):
        return "merge"
    return "route_department"


def build_graph() -> StateGraph:
    """Build and compile the complaint processing graph."""
    graph = StateGraph(ComplaintState)

    # Add nodes
    graph.add_node("intake", intake_node)
    graph.add_node("triage", triage_node)
    graph.add_node("classify", classify_node)
    graph.add_node("emergency_fast_path", emergency_fast_path_node)
    graph.add_node("duplicate_check", duplicate_check_node)
    graph.add_node("merge", merge_node)
    graph.add_node("route_department", route_department_node)
    graph.add_node("summarize", summarize_node)
    graph.add_node("resolution_planner", resolution_planner_node)

    # Set entry point
    graph.set_entry_point("intake")

    # Linear edges
    graph.add_edge("intake", "triage")
    graph.add_edge("triage", "classify")

    # Conditional: after classify → emergency fast-path OR duplicate check
    graph.add_conditional_edges(
        "classify",
        _after_classify,
        {
            "emergency_fast_path": "emergency_fast_path",
            "duplicate_check": "duplicate_check",
        },
    )

    # Emergency fast-path goes directly to route_department
    graph.add_edge("emergency_fast_path", "route_department")

    # Conditional: after duplicate check → merge OR route_department
    graph.add_conditional_edges(
        "duplicate_check",
        _after_duplicate_check,
        {
            "merge": "merge",
            "route_department": "route_department",
        },
    )

    # Merge also continues to route_department
    graph.add_edge("merge", "route_department")

    # After routing → summarize → resolution_planner → END
    graph.add_edge("route_department", "summarize")
    graph.add_edge("summarize", "resolution_planner")
    graph.add_edge("resolution_planner", END)

    return graph.compile()


# Compile once at module level
_compiled_graph = None


def get_compiled_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


def run_complaint_pipeline(transcript: str, citizen_location: str = None) -> ComplaintState:
    """
    Run the full complaint processing pipeline.
    Returns the final ComplaintState with all fields populated.
    """
    graph = get_compiled_graph()

    initial_state: ComplaintState = {
        "transcript": transcript,
        "citizen_location": citizen_location,
        "category": None,
        "urgency": None,
        "sentiment": None,
        "summary": None,
        "department": None,
        "department_confidence": None,
        "is_duplicate": False,
        "duplicate_of_id": None,
        "duplicate_confidence": None,
        "embedding": None,
        "resolution_steps": None,
        "department_contact_needed": None,
        "draft_department_message": None,
        "draft_citizen_ack": None,
        "department_contact_info": None,
        "trace": [],
    }

    result = graph.invoke(initial_state)
    return result
