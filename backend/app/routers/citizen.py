"""
Citizen API router — citizen complaints list, detail milestone view, citizen follow-up.
"""
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Complaint, ResolutionStep, ComplaintTimelineEntry
from app.schemas import (
    ComplaintListItem,
    CitizenComplaintDetail,
    CitizenFollowupRequest,
    ComplaintTimelineEntryResponse,
)

router = APIRouter()


def _citizen_friendly_step(step_text: str, department: str) -> str:
    """Format internal step text into citizen-friendly milestone description."""
    lower = step_text.lower()
    if "contact" in lower and "control room" in lower:
        return f"Forwarded to {department or 'Department'}"
    if "dispatch" in lower or "crew" in lower:
        return f"Inspection & repair team dispatched"
    if "confirm" in lower or "close" in lower or "restoration" in lower:
        return "Work verified and ticket completed"
    return step_text


@router.get("/complaints", response_model=List[ComplaintListItem])
def list_citizen_complaints(
    citizen_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get all complaints submitted by a citizen, or recent complaints if citizen_id is omitted."""
    query = db.query(Complaint)
    if citizen_id and citizen_id.strip():
        # Match email / phone / ID
        query = query.filter(Complaint.citizen_id.ilike(f"%{citizen_id.strip()}%"))

    complaints = query.order_by(Complaint.created_at.desc()).all()

    return [
        ComplaintListItem(
            id=c.id,
            category=c.category,
            urgency=c.urgency,
            status=c.status,
            department_recommended=c.department_recommended,
            created_at=c.created_at,
            transcript_excerpt=c.transcript[:120] + "..." if c.transcript and len(c.transcript) > 120 else (c.transcript or ""),
            citizen_location=c.citizen_location,
            is_duplicate_of=c.is_duplicate_of,
            summary=c.summary,
        )
        for c in complaints
    ]


@router.get("/complaints/{complaint_id}", response_model=CitizenComplaintDetail)
def get_citizen_complaint(complaint_id: int, db: Session = Depends(get_db)):
    """Get detailed citizen view of a complaint with citizen-safe steps and visible timeline entries."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    steps = db.query(ResolutionStep).filter(ResolutionStep.complaint_id == complaint_id).order_by(ResolutionStep.id.asc()).all()
    timeline_entries = (
        db.query(ComplaintTimelineEntry)
        .filter(ComplaintTimelineEntry.complaint_id == complaint_id, ComplaintTimelineEntry.visible_to_citizen == True)  # noqa: E712
        .order_by(ComplaintTimelineEntry.created_at.asc())
        .all()
    )

    steps_summary = [
        {
            "id": s.id,
            "title": _citizen_friendly_step(s.step_text, complaint.department_recommended),
            "status": s.status,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in steps
    ]

    audit_trace = []
    if complaint.reasoning_trace:
        try:
            audit_trace = json.loads(complaint.reasoning_trace)
        except (json.JSONDecodeError, TypeError):
            audit_trace = []

    return CitizenComplaintDetail(
        id=complaint.id,
        category=complaint.category,
        urgency=complaint.urgency,
        status=complaint.status,
        summary=complaint.summary,
        department_recommended=complaint.department_recommended,
        created_at=complaint.created_at,
        citizen_location=complaint.citizen_location,
        steps_summary=steps_summary,
        timeline=[
            ComplaintTimelineEntryResponse(
                id=t.id,
                complaint_id=t.complaint_id,
                actor=t.actor,
                message=t.message,
                visible_to_citizen=t.visible_to_citizen,
                created_at=t.created_at,
            )
            for t in timeline_entries
        ],
        audit_log=audit_trace,
    )


@router.post("/complaints/{complaint_id}/followup", response_model=ComplaintTimelineEntryResponse)
def citizen_followup(complaint_id: int, req: CitizenFollowupRequest, db: Session = Depends(get_db)):
    """Citizen adds a follow-up comment to the complaint timeline."""
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Follow-up message cannot be empty")

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    entry = ComplaintTimelineEntry(
        complaint_id=complaint_id,
        actor="citizen",
        message=req.message.strip(),
        visible_to_citizen=True,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry
