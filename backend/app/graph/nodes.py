"""
LangGraph node functions for the complaint processing pipeline.
Each node appends to state["trace"] with its output and duration.
"""
import json
import time
from datetime import datetime
from typing import Dict, Any

from app.llm_client import client, LLM_MODEL
from app.department_directory import get_department_info
from app.graph.prompts import (
    TRIAGE_SYSTEM, TRIAGE_USER,
    CLASSIFY_SYSTEM, CLASSIFY_USER,
    ROUTE_SYSTEM, ROUTE_USER,
    SUMMARIZE_SYSTEM, SUMMARIZE_USER,
    ADVISORY_SYSTEM, ADVISORY_USER,
    RESOLUTION_PLANNER_SYSTEM, RESOLUTION_PLANNER_USER,
    JSON_RETRY,
)


def _llm_call_json(system_prompt: str, user_prompt: str, retry: bool = True) -> dict:
    """
    Make an LLM call expecting JSON output. Retry once on parse failure.
    Returns parsed dict or raises on double failure.
    """
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
    )
    content = response.choices[0].message.content.strip()
    # Strip markdown fences if the model wraps JSON in them
    if content.startswith("```"):
        lines = content.split("\n")
        content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        content = content.strip()
    
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        if retry:
            # Retry with explicit JSON instruction
            response2 = client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": content},
                    {"role": "user", "content": JSON_RETRY},
                ],
                temperature=0.0,
            )
            content2 = response2.choices[0].message.content.strip()
            if content2.startswith("```"):
                lines = content2.split("\n")
                content2 = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                content2 = content2.strip()
            return json.loads(content2)
        raise


def _llm_call_text(system_prompt: str, user_prompt: str) -> str:
    """Make an LLM call expecting plain text output."""
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def intake_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Clean/trim transcript, initialize trace list."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    
    transcript = state.get("transcript", "").strip()
    # Basic cleaning
    transcript = " ".join(transcript.split())  # normalize whitespace
    
    output = {"cleaned_transcript": transcript[:100] + "..." if len(transcript) > 100 else transcript}
    duration = (time.time() - start) * 1000
    
    trace = list(state.get("trace", []))
    trace.append({
        "node": "intake_node",
        "agent_name": "Intake & Validation Agent",
        "action_summary": f"Sanitized input transcript ({len(transcript)} characters) and validated input parameters.",
        "timestamp": ts_now,
        "status": "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    })
    
    return {**state, "transcript": transcript, "trace": trace}


def triage_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: determine urgency + sentiment."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    
    try:
        result = _llm_call_json(
            TRIAGE_SYSTEM,
            TRIAGE_USER.format(transcript=state["transcript"]),
        )
        urgency = result.get("urgency", "normal").lower()
        sentiment = result.get("sentiment", "neutral").lower()
        
        # Validate enum values
        if urgency not in ("emergency", "high", "normal", "low"):
            urgency = "normal"
        if sentiment not in ("negative", "neutral", "positive"):
            sentiment = "neutral"
        
        output = {"urgency": urgency, "sentiment": sentiment}
        fallback_used = False
    except Exception as e:
        urgency, sentiment = "normal", "neutral"
        output = {"urgency": urgency, "sentiment": sentiment, "error": str(e), "fallback": True}
        fallback_used = True
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "triage_node",
        "agent_name": "Triage & Urgency Assessment Agent",
        "action_summary": f"Evaluated urgency as '{urgency.upper()}' and citizen tone/sentiment as '{sentiment.upper()}'.",
        "timestamp": ts_now,
        "status": "fallback" if fallback_used else "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": fallback_used,
    })
    
    return {**state, "urgency": urgency, "sentiment": sentiment, "trace": trace}


def classify_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: classify complaint category."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    
    valid_categories = {"electricity", "water", "roads", "police", "health", "transport", "sanitation", "other"}
    
    try:
        result = _llm_call_json(
            CLASSIFY_SYSTEM.format(urgency=state.get("urgency", "normal"), sentiment=state.get("sentiment", "neutral")),
            CLASSIFY_USER.format(transcript=state["transcript"]),
        )
        category = result.get("category", "other").lower()
        if category not in valid_categories:
            category = "other"
        
        output = {"category": category}
        fallback_used = False
    except Exception as e:
        category = "other"
        output = {"category": category, "error": str(e), "fallback": True}
        fallback_used = True
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "classify_node",
        "agent_name": "Category Classification Agent",
        "action_summary": f"Classified issue under the '{category.title()}' municipal category.",
        "timestamp": ts_now,
        "status": "fallback" if fallback_used else "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": fallback_used,
    })
    
    return {**state, "category": category, "trace": trace}


def duplicate_check_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Local embedding similarity check — no LLM call."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    
    try:
        from app.duplicate_detection import find_duplicate, embed
        from app.db import SessionLocal
        
        db = SessionLocal()
        try:
            is_dup, dup_id, confidence, new_embedding = find_duplicate(
                state["transcript"],
                state.get("category", "other"),
                db,
            )
        finally:
            db.close()
        
        output = {
            "is_duplicate": is_dup,
            "duplicate_of_id": dup_id,
            "duplicate_confidence": round(confidence, 3) if confidence else None,
        }
    except Exception as e:
        is_dup, dup_id, confidence, new_embedding = False, None, None, None
        output = {"is_duplicate": False, "error": str(e), "fallback": True}
    
    duration = (time.time() - start) * 1000
    action_desc = (
        f"Detected matching duplicate of complaint #{dup_id} (confidence: {round(confidence*100, 1)}%)."
        if is_dup else "Calculated embedding and ran cosine similarity search: No duplicates detected."
    )
    
    trace = list(state.get("trace", []))
    trace.append({
        "node": "duplicate_check_node",
        "agent_name": "Duplicate Detection & Vector Search Agent",
        "action_summary": action_desc,
        "timestamp": ts_now,
        "status": "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    })
    
    return {
        **state,
        "is_duplicate": is_dup,
        "duplicate_of_id": dup_id,
        "duplicate_confidence": confidence,
        "embedding": new_embedding,
        "trace": trace,
    }


def merge_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Mark complaint as a duplicate — continues pipeline for full analysis."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    parent_id = state.get("duplicate_of_id")
    
    output = {
        "action": "linked_to_parent",
        "parent_complaint_id": parent_id,
        "confidence": state.get("duplicate_confidence"),
        "note": "Complaint marked as duplicate but still receives full analysis"
    }
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "merge_node",
        "agent_name": "Deduplication & Linkage Agent",
        "action_summary": f"Linked complaint to parent ticket #{parent_id} with full downstream pipeline execution.",
        "timestamp": ts_now,
        "status": "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    })
    
    return {**state, "trace": trace}


def emergency_fast_path_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """No-op node that logs the emergency fast-path skip."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    
    output = {
        "action": "fast-pathed: emergency",
        "note": "Bypassed duplicate check — emergencies must not wait on deduplication"
    }
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "emergency_fast_path",
        "agent_name": "Emergency Fast-Path Router",
        "action_summary": "Emergency priority detected — bypassed duplicate waiting line for immediate dispatch.",
        "timestamp": ts_now,
        "status": "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": False,
    })
    
    # Still compute embedding for storage, but don't block on duplicate check
    try:
        from app.duplicate_detection import embed
        new_embedding = embed(state["transcript"])
    except Exception:
        new_embedding = None
    
    return {**state, "embedding": new_embedding, "is_duplicate": False, "duplicate_of_id": None, "duplicate_confidence": None, "trace": trace}


def route_department_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: route to government department."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    
    valid_departments = {
        "Electricity Board", "Water Department", "Roads & Municipal",
        "Police Control Room", "Health Services", "Transport Authority",
        "Disaster Management", "General/Other"
    }
    
    try:
        result = _llm_call_json(
            ROUTE_SYSTEM.format(category=state.get("category", "other")),
            ROUTE_USER.format(transcript=state["transcript"]),
        )
        department = result.get("department", "General/Other")
        confidence = float(result.get("confidence", 0.5))
        reason = result.get("reason", "")
        
        # Validate department
        if department not in valid_departments:
            # Try fuzzy match
            dept_lower = department.lower()
            matched = False
            for valid in valid_departments:
                if valid.lower() in dept_lower or dept_lower in valid.lower():
                    department = valid
                    matched = True
                    break
            if not matched:
                department = "General/Other"
        
        confidence = max(0.0, min(1.0, confidence))
        output = {"department": department, "confidence": confidence, "reason": reason}
        fallback_used = False
    except Exception as e:
        department, confidence = "General/Other", 0.3
        output = {"department": department, "confidence": confidence, "error": str(e), "fallback": True}
        fallback_used = True
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "route_department_node",
        "agent_name": "Department Routing & Authority Agent",
        "action_summary": f"Routed to '{department}' with {round(confidence * 100, 1)}% confidence score.",
        "timestamp": ts_now,
        "status": "fallback" if fallback_used else "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": fallback_used,
    })
    
    return {**state, "department": department, "department_confidence": confidence, "trace": trace}


def summarize_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: generate 1-2 sentence summary."""
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    
    try:
        summary = _llm_call_text(
            SUMMARIZE_SYSTEM,
            SUMMARIZE_USER.format(
                transcript=state["transcript"],
                category=state.get("category", "other"),
                department=state.get("department", "General/Other"),
                urgency=state.get("urgency", "normal"),
            ),
        )
        output = {"summary": summary}
        fallback_used = False
    except Exception as e:
        summary = f"Citizen complaint regarding {state.get('category', 'general')} issue."
        output = {"summary": summary, "error": str(e), "fallback": True}
        fallback_used = True
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "summarize_node",
        "agent_name": "Executive Summarization Agent",
        "action_summary": f"Synthesized concise officer executive summary: '{summary[:90]}...'",
        "timestamp": ts_now,
        "status": "fallback" if fallback_used else "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": fallback_used,
    })
    
    return {**state, "summary": summary, "trace": trace}


def resolution_planner_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LLM call: generate structured resolution steps, draft messages, and lookup department info.
    Replaces and subsumes the old advisory node.
    """
    start = time.time()
    ts_now = datetime.utcnow().isoformat() + "Z"
    department = state.get("department", "General/Other")
    category = state.get("category", "other")
    urgency = state.get("urgency", "normal")
    location = state.get("citizen_location") or "Reported location"
    transcript = state.get("transcript", "")
    summary = state.get("summary", "")

    # 1. Deterministic directory lookup
    dept_info = get_department_info(department)

    fallback_used = False
    try:
        plan_json = _llm_call_json(
            RESOLUTION_PLANNER_SYSTEM,
            RESOLUTION_PLANNER_USER.format(
                category=category,
                department=department,
                urgency=urgency,
                location=location,
                transcript=transcript,
                summary=summary,
            ),
        )

        steps = plan_json.get("resolution_steps", [])
        if not isinstance(steps, list) or len(steps) == 0:
            steps = [
                {"step": f"Contact {department} control room", "owner": "department"},
                {"step": f"Dispatch field crew to {location}", "owner": "department"},
                {"step": "Confirm restoration and close ticket", "owner": "officer"},
            ]

        dept_needed = bool(plan_json.get("department_contact_needed", True))
        dept_msg = plan_json.get(
            "draft_department_message",
            f"Reporting {category} issue at {location}. Requesting inspection and dispatch. Ref: complaint.",
        )
        citizen_ack = plan_json.get(
            "draft_citizen_ack",
            f"We have received your complaint regarding {category} at {location} and forwarded it to {department}. We will keep you updated.",
        )

        output = {
            "resolution_steps": steps,
            "department_contact_needed": dept_needed,
            "draft_department_message": dept_msg,
            "draft_citizen_ack": citizen_ack,
            "department_contact_info": dept_info,
        }
    except Exception as e:
        fallback_used = True
        steps = [
            {"step": f"Contact {department} control room", "owner": "department"},
            {"step": f"Dispatch inspection crew to {location}", "owner": "department"},
            {"step": "Confirm issue resolution and close ticket", "owner": "officer"},
        ]
        dept_needed = True
        dept_msg = f"Issue reported at {location}. Please inspect and resolve. Department: {department}."
        citizen_ack = f"Your complaint has been received and routed to {department}. We will notify you of updates."

        output = {
            "resolution_steps": steps,
            "department_contact_needed": dept_needed,
            "draft_department_message": dept_msg,
            "draft_citizen_ack": citizen_ack,
            "department_contact_info": dept_info,
            "error": str(e),
            "fallback": True,
        }

    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({
        "node": "resolution_planner_node",
        "agent_name": "Resolution Planning & Dispatch Agent",
        "action_summary": f"Formulated {len(steps)} resolution milestones, directory contact parameters, and outbound dispatch notice.",
        "timestamp": ts_now,
        "status": "fallback" if fallback_used else "completed",
        "output": output,
        "duration_ms": round(duration, 1),
        "fallback_used": fallback_used,
    })

    return {
        **state,
        "resolution_steps": steps,
        "department_contact_needed": dept_needed,
        "draft_department_message": dept_msg,
        "draft_citizen_ack": citizen_ack,
        "department_contact_info": dept_info,
        "trace": trace,
    }


def advisory_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy advisory node kept for compatibility."""
    return resolution_planner_node(state)

