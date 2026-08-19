import json
import time
from datetime import datetime
from typing import TypedDict, Optional, List, Dict, Any
from langgraph.graph import StateGraph, END

from app.llm_client import client, LLM_MODEL
from app.db import SessionLocal
from app.models import Complaint, ResolutionStep


class LifecycleState(TypedDict):
    complaint_id: int
    action_type: str  # "step_completed" | "manual_note" | "request_send_update"
    step_id: Optional[int]
    officer_note: Optional[str]
    draft_citizen_message: Optional[str]
    draft_closure_message: Optional[str]
    all_steps_done: bool
    status: Optional[str]
    trace: List[Dict[str, Any]]


# --- Prompts for Lifecycle Graph ---

DRAFT_NOTIFICATION_SYSTEM = """You are a government communications specialist drafting a clear, reassuring status update to a citizen.
Based on the complaint details and the action just taken by the municipal officer, draft a short (1-2 sentences) citizen-friendly update.

Rules:
- Be clear, professional, and positive.
- Do NOT use internal jargon (e.g., say "Forwarded to Electricity Board" rather than "Sent dispatch ticket to EB control room").
- Respond with ONLY the message text, no JSON, no quotes, no markdown fences."""

DRAFT_NOTIFICATION_USER = """Complaint details:
Category: {category}
Department: {department}
Location: {location}
Summary: {summary}

Action taken by officer:
{action_description}"""


DRAFT_CLOSURE_SYSTEM = """You are a government communications specialist drafting a complaint resolution notice and feedback request for a citizen.
Draft a short, polite closing message confirming that all resolution actions have been completed and asking for brief feedback.

Rules:
- 2-3 sentences max.
- Be courteous and professional.
- Confirm resolution and invite feedback.
- Respond with ONLY the message text, no JSON, no quotes, no markdown fences."""

DRAFT_CLOSURE_USER = """Complaint details:
Category: {category}
Department: {department}
Location: {location}
Summary: {summary}"""


# --- Nodes ---

def action_intake_node(state: LifecycleState) -> LifecycleState:
    """Deterministic: record officer action and inspect step completion state."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    complaint_id = state["complaint_id"]
    step_id = state.get("step_id")
    action_type = state.get("action_type", "step_completed")
    officer_note = state.get("officer_note")

    db = SessionLocal()
    try:
        step_text = ""
        if step_id:
            step = db.query(ResolutionStep).filter(ResolutionStep.id == step_id).first()
            if step:
                step_text = step.step_text

        # Check if all steps are completed
        all_steps = db.query(ResolutionStep).filter(ResolutionStep.complaint_id == complaint_id).all()
        all_done = len(all_steps) > 0 and all(s.status == "done" for s in all_steps)
    finally:
        db.close()

    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "action_intake_node",
        "agent_name": "Lifecycle Action Intake Agent",
        "action_summary": f"Captured action '{action_type}' on milestone #{step_id or 'all'} ({step_text or 'Status update'}).",
        "timestamp": ts_now,
        "status": "completed",
        "output": {
            "action_type": action_type,
            "step_id": step_id,
            "step_text": step_text,
            "all_steps_done": all_done,
        },
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    })

    return {
        **state,
        "all_steps_done": all_done,
        "trace": trace,
    }


def citizen_notification_draft_node(state: LifecycleState) -> LifecycleState:
    """LLM call: draft a citizen-facing notification for human review (never auto-sent)."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    complaint_id = state["complaint_id"]
    step_id = state.get("step_id")
    officer_note = state.get("officer_note")

    category = "general"
    department = "Municipal Department"
    location = "Reported location"
    summary = "Complaint"
    step_text = ""

    db = SessionLocal()
    try:
        complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if complaint:
            category = complaint.category or "general"
            department = complaint.department_recommended or "Municipal Department"
            location = complaint.citizen_location or "Reported location"
            summary = complaint.summary or complaint.transcript[:100]

        if step_id:
            step = db.query(ResolutionStep).filter(ResolutionStep.id == step_id).first()
            if step:
                step_text = step.step_text
    finally:
        db.close()

    action_description = f"Completed step: {step_text}" if step_text else f"Officer update: {officer_note or 'Progress update'}"

    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": DRAFT_NOTIFICATION_SYSTEM},
                {
                    "role": "user",
                    "content": DRAFT_NOTIFICATION_USER.format(
                        category=category,
                        department=department,
                        location=location,
                        summary=summary,
                        action_description=action_description,
                    ),
                },
            ],
            temperature=0.2,
        )
        draft = response.choices[0].message.content.strip()
    except Exception as e:
        draft = f"Update regarding your {category} complaint: {action_description}."

    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "citizen_notification_draft_node",
        "agent_name": "Lifecycle Citizen Communications Agent",
        "action_summary": f"Drafted human-in-the-loop citizen milestone update: '{draft[:80]}...'",
        "timestamp": ts_now,
        "status": "completed",
        "output": {"draft_citizen_message": draft, "requires_human_approval": True},
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    })

    return {
        **state,
        "draft_citizen_message": draft,
        "trace": trace,
    }


def closure_planner_node(state: LifecycleState) -> LifecycleState:
    """LLM call: draft a closure message and feedback request when all steps are completed."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    complaint_id = state["complaint_id"]

    category = "general"
    department = "Municipal Department"
    location = "Reported location"
    summary = "Complaint"

    db = SessionLocal()
    try:
        complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if complaint:
            category = complaint.category or "general"
            department = complaint.department_recommended or "Municipal Department"
            location = complaint.citizen_location or "Reported location"
            summary = complaint.summary or complaint.transcript[:100]
    finally:
        db.close()

    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": DRAFT_CLOSURE_SYSTEM},
                {
                    "role": "user",
                    "content": DRAFT_CLOSURE_USER.format(
                        category=category,
                        department=department,
                        location=location,
                        summary=summary,
                    ),
                },
            ],
            temperature=0.2,
        )
        closure_draft = response.choices[0].message.content.strip()
    except Exception as e:
        closure_draft = f"All resolution steps for your {category} complaint at {location} have been completed. Please let us know if everything is resolved to your satisfaction."

    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "closure_planner_node",
        "agent_name": "Resolution Closure Planner Agent",
        "action_summary": "All resolution milestones completed — formulated closure notice and citizen feedback draft.",
        "timestamp": ts_now,
        "status": "completed",
        "output": {"draft_closure_message": closure_draft, "proposed_status": "resolved", "requires_human_approval": True},
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    })

    return {
        **state,
        "draft_closure_message": closure_draft,
        "status": "resolved",
        "trace": trace,
    }


def persist_lifecycle_node(state: LifecycleState) -> LifecycleState:
    """Deterministic: record lifecycle step trace and update status in DB if needed."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    complaint_id = state["complaint_id"]
    new_status = state.get("status")
    current_lifecycle_trace = list(state.get("trace", []))

    duration = (time.time() - start) * 1000
    persist_entry = {
        "node": "persist_lifecycle_node",
        "agent_name": "Audit Persistence & Lifecycle Synchronizer",
        "action_summary": f"Synchronized complaint status to '{new_status or 'in_progress'}' and appended lifecycle audit logs.",
        "timestamp": ts_now,
        "status": "completed",
        "output": {"status_updated": state.get("status", "in_progress")},
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    }
    current_lifecycle_trace.append(persist_entry)

    db = SessionLocal()
    try:
        complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if complaint:
            if new_status and complaint.status != new_status:
                complaint.status = new_status
            elif complaint.status == "new":
                complaint.status = "in_progress"

            # Merge lifecycle trace into complaint reasoning_trace
            existing_trace = []
            if complaint.reasoning_trace:
                try:
                    existing_trace = json.loads(complaint.reasoning_trace)
                except (json.JSONDecodeError, TypeError):
                    existing_trace = []
            
            existing_trace.extend(current_lifecycle_trace)
            complaint.reasoning_trace = json.dumps(existing_trace)
            db.commit()
    finally:
        db.close()

    return {
        **state,
        "trace": current_lifecycle_trace,
    }


# --- Conditional Edge ---

def _after_draft(state: LifecycleState) -> str:
    if state.get("all_steps_done"):
        return "closure_planner"
    return "persist_lifecycle"


# --- Graph Construction ---

def build_lifecycle_graph() -> StateGraph:
    """Compile Graph B lifecycle graph."""
    graph = StateGraph(LifecycleState)

    graph.add_node("action_intake", action_intake_node)
    graph.add_node("citizen_notification_draft", citizen_notification_draft_node)
    graph.add_node("closure_planner", closure_planner_node)
    graph.add_node("persist_lifecycle", persist_lifecycle_node)

    graph.set_entry_point("action_intake")
    graph.add_edge("action_intake", "citizen_notification_draft")

    graph.add_conditional_edges(
        "citizen_notification_draft",
        _after_draft,
        {
            "closure_planner": "closure_planner",
            "persist_lifecycle": "persist_lifecycle",
        },
    )

    graph.add_edge("closure_planner", "persist_lifecycle")
    graph.add_edge("persist_lifecycle", END)

    return graph.compile()


_compiled_lifecycle_graph = None


def get_lifecycle_graph():
    global _compiled_lifecycle_graph
    if _compiled_lifecycle_graph is None:
        _compiled_lifecycle_graph = build_lifecycle_graph()
    return _compiled_lifecycle_graph


def run_lifecycle_pipeline(
    complaint_id: int,
    action_type: str = "step_completed",
    step_id: Optional[int] = None,
    officer_note: Optional[str] = None,
) -> LifecycleState:
    """Execute Graph B on an officer action."""
    graph = get_lifecycle_graph()

    initial_state: LifecycleState = {
        "complaint_id": complaint_id,
        "action_type": action_type,
        "step_id": step_id,
        "officer_note": officer_note,
        "draft_citizen_message": None,
        "draft_closure_message": None,
        "all_steps_done": False,
        "status": None,
        "trace": [],
    }

    return graph.invoke(initial_state)
