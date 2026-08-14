from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


# --- Request schemas ---

class ComplaintAnalyzeRequest(BaseModel):
    transcript: str
    citizen_location: Optional[str] = None
    citizen_id: Optional[str] = None


class ComplaintStatusUpdate(BaseModel):
    status: str  # new|assigned|in_progress|resolved


class ChatbotQueryRequest(BaseModel):
    query: str
    complaint_id: Optional[int] = None
    citizen_id: Optional[str] = None


# --- Response schemas ---

class TraceStep(BaseModel):
    node: str
    output: Dict[str, Any]
    duration_ms: Optional[float] = None


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
