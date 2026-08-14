"""
LangGraph node functions for the complaint processing pipeline.
Each node appends to state["trace"] with its output and duration.
"""
import json
import time
from typing import Dict, Any

from app.llm_client import client, LLM_MODEL
from app.graph.prompts import (
    TRIAGE_SYSTEM, TRIAGE_USER,
    CLASSIFY_SYSTEM, CLASSIFY_USER,
    ROUTE_SYSTEM, ROUTE_USER,
    SUMMARIZE_SYSTEM, SUMMARIZE_USER,
    ADVISORY_SYSTEM, ADVISORY_USER,
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
    
    transcript = state.get("transcript", "").strip()
    # Basic cleaning
    transcript = " ".join(transcript.split())  # normalize whitespace
    
    output = {"cleaned_transcript": transcript[:100] + "..." if len(transcript) > 100 else transcript}
    duration = (time.time() - start) * 1000
    
    trace = list(state.get("trace", []))
    trace.append({"node": "intake_node", "output": output, "duration_ms": round(duration, 1)})
    
    return {**state, "transcript": transcript, "trace": trace}


def triage_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: determine urgency + sentiment."""
    start = time.time()
    
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
    trace_entry = {"node": "triage_node", "output": output, "duration_ms": round(duration, 1)}
    if fallback_used:
        trace_entry["fallback_used"] = True
    trace.append(trace_entry)
    
    return {**state, "urgency": urgency, "sentiment": sentiment, "trace": trace}


def classify_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: classify complaint category."""
    start = time.time()
    
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
    trace_entry = {"node": "classify_node", "output": output, "duration_ms": round(duration, 1)}
    if fallback_used:
        trace_entry["fallback_used"] = True
    trace.append(trace_entry)
    
    return {**state, "category": category, "trace": trace}


def duplicate_check_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Local embedding similarity check — no LLM call."""
    start = time.time()
    
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
    trace = list(state.get("trace", []))
    trace.append({"node": "duplicate_check_node", "output": output, "duration_ms": round(duration, 1)})
    
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
    
    output = {
        "action": "linked_to_parent",
        "parent_complaint_id": state.get("duplicate_of_id"),
        "confidence": state.get("duplicate_confidence"),
        "note": "Complaint marked as duplicate but still receives full analysis"
    }
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({"node": "merge_node", "output": output, "duration_ms": round(duration, 1)})
    
    return {**state, "trace": trace}


def emergency_fast_path_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """No-op node that logs the emergency fast-path skip."""
    start = time.time()
    
    output = {
        "action": "fast-pathed: emergency",
        "note": "Bypassed duplicate check — emergencies must not wait on deduplication"
    }
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({"node": "emergency_fast_path", "output": output, "duration_ms": round(duration, 1)})
    
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
    trace_entry = {"node": "route_department_node", "output": output, "duration_ms": round(duration, 1)}
    if fallback_used:
        trace_entry["fallback_used"] = True
    trace.append(trace_entry)
    
    return {**state, "department": department, "department_confidence": confidence, "trace": trace}


def summarize_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: generate 1-2 sentence summary."""
    start = time.time()
    
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
    trace_entry = {"node": "summarize_node", "output": output, "duration_ms": round(duration, 1)}
    if fallback_used:
        trace_entry["fallback_used"] = True
    trace.append(trace_entry)
    
    return {**state, "summary": summary, "trace": trace}


def advisory_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """LLM call: suggest next action for officer (stretch goal)."""
    start = time.time()
    
    try:
        advisory = _llm_call_text(
            ADVISORY_SYSTEM,
            ADVISORY_USER.format(
                category=state.get("category", "other"),
                department=state.get("department", "General/Other"),
                summary=state.get("summary", ""),
                urgency=state.get("urgency", "normal"),
            ),
        )
        output = {"advisory": advisory}
    except Exception as e:
        advisory = "Review complaint details and assign to the appropriate field officer."
        output = {"advisory": advisory, "error": str(e), "fallback": True}
    
    duration = (time.time() - start) * 1000
    trace = list(state.get("trace", []))
    trace.append({"node": "advisory_node", "output": output, "duration_ms": round(duration, 1)})
    
    return {**state, "trace": trace}
