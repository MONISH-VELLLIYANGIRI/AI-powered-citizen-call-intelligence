from typing import TypedDict, Optional, List, Dict, Any


class ComplaintState(TypedDict):
    transcript: str
    citizen_location: Optional[str]
    category: Optional[str]
    urgency: Optional[str]
    sentiment: Optional[str]
    summary: Optional[str]
    department: Optional[str]
    department_confidence: Optional[float]
    is_duplicate: bool
    duplicate_of_id: Optional[int]
    duplicate_confidence: Optional[float]
    embedding: Optional[List[float]]
    # Resolution Planning
    resolution_steps: Optional[List[Dict[str, str]]]
    department_contact_needed: Optional[bool]
    draft_department_message: Optional[str]
    draft_citizen_ack: Optional[str]
    department_contact_info: Optional[Dict[str, Any]]
    trace: List[Dict[str, Any]]  # append {"node": name, "output": {...}, "duration_ms": ...} at every step
