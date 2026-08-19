from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


# --- Request schemas ---

class ComplaintAnalyzeRequest(BaseModel):
    transcript: str
    citizen_location: str
    citizen_id: str


class ComplaintStatusUpdate(BaseModel):
    status: str  # new|assigned|in_progress|resolved


class ChatbotQueryRequest(BaseModel):
    query: str
    complaint_id: Optional[int] = None
    citizen_id: Optional[str] = None


# --- Response schemas ---

class ResolutionStepResponse(BaseModel):
    id: int
    complaint_id: int
    step_text: str
    owner: str
    status: str
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ResolutionStepUpdate(BaseModel):
    status: str  # pending | done


class ComplaintTimelineEntryResponse(BaseModel):
    id: int
    complaint_id: int
    actor: str  # system | officer | citizen
    message: str
    visible_to_citizen: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TimelineSendRequest(BaseModel):
    message: str
    visible_to_citizen: bool = True


class CitizenFollowupRequest(BaseModel):
    message: str


class ResolutionDraftResponse(BaseModel):
    step_id: int
    status: str
    draft_citizen_message: Optional[str] = None
    all_steps_done: bool = False
    draft_closure_message: Optional[str] = None


class TraceStep(BaseModel):
    node: str
    agent_name: Optional[str] = None
    action_summary: Optional[str] = None
    timestamp: Optional[str] = None
    status: Optional[str] = "completed"
    output: Dict[str, Any]
    duration_ms: Optional[float] = None
    fallback_used: Optional[bool] = False


class CitizenComplaintDetail(BaseModel):
    id: int
    category: Optional[str] = None
    urgency: Optional[str] = None
    status: str
    summary: Optional[str] = None
    department_recommended: Optional[str] = None
    created_at: datetime
    citizen_location: Optional[str] = None
    steps_summary: List[Dict[str, Any]] = []
    timeline: List[ComplaintTimelineEntryResponse] = []
    audit_log: Optional[List[TraceStep]] = []


class OfficerQueueItem(BaseModel):
    id: int
    category: Optional[str] = None
    urgency: Optional[str] = None
    status: str
    department_recommended: Optional[str] = None
    created_at: datetime
    summary: Optional[str] = None
    citizen_location: Optional[str] = None
    department_confidence: Optional[float] = None
    total_steps: int = 0
    completed_steps: int = 0


class ComplaintAuditLogResponse(BaseModel):
    complaint_id: int
    total_steps: int
    total_duration_ms: float
    created_at: datetime
    trace: List[TraceStep]


class ComplaintResponse(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime
    raw_input_type: str
    transcript: str
    citizen_id: Optional[str] = None
    citizen_location: Optional[str] = None
    category: Optional[str] = None
    urgency: Optional[str] = None
    sentiment: Optional[str] = None
    summary: Optional[str] = None
    department_recommended: Optional[str] = None
    department_confidence: Optional[float] = None
    is_duplicate_of: Optional[int] = None
    duplicate_confidence: Optional[float] = None
    status: str
    reasoning_trace: Optional[List[TraceStep]] = None
    resolution_steps: Optional[List[ResolutionStepResponse]] = None
    department_contact_info: Optional[Dict[str, Any]] = None
    draft_department_message: Optional[str] = None
    draft_citizen_ack: Optional[str] = None

    class Config:
        from_attributes = True


class ComplaintListItem(BaseModel):
    id: int
    category: Optional[str] = None
    urgency: Optional[str] = None
    status: str
    department_recommended: Optional[str] = None
    created_at: datetime
    transcript_excerpt: str
    citizen_location: Optional[str] = None
    is_duplicate_of: Optional[int] = None
    summary: Optional[str] = None

    class Config:
        from_attributes = True


class AnalyticsSummary(BaseModel):
    total: int
    by_category: Dict[str, int]
    by_urgency: Dict[str, int]
    by_status: Dict[str, int]
    avg_resolution_hours: Optional[float] = None
    trend_last_14_days: List[Dict[str, Any]]


class HotspotItem(BaseModel):
    location: str
    category: str
    count: int


class ChatbotResponse(BaseModel):
    answer: str


class AutonomousResolutionResponse(BaseModel):
    complaint_id: int
    status: str
    steps_completed: int
    trace_added: int
    closure_message: Optional[str] = None
    dispatch_info: Optional[Dict[str, Any]] = None


class AutonomousStepResolutionResponse(BaseModel):
    step_id: int
    status: str
    complaint_status: str
    all_steps_done: bool
    citizen_update: Optional[str] = None

