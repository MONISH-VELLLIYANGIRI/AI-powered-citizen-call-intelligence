"""
Complaints API router — analyze, list, detail, update, transcribe, resolution steps, timeline.
"""
import io
import json
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Complaint, ResolutionStep, ComplaintTimelineEntry
from app.schemas import (
    ComplaintAnalyzeRequest,
    ComplaintResponse,
    ComplaintListItem,
    ComplaintStatusUpdate,
    ResolutionStepResponse,
    ResolutionStepUpdate,
    ComplaintTimelineEntryResponse,
    TimelineSendRequest,
    ResolutionDraftResponse,
    TraceStep,
    ComplaintAuditLogResponse,
    AutonomousResolutionResponse,
    AutonomousStepResolutionResponse,
)
from app.department_directory import get_department_info
from app.graph.build_graph import run_complaint_pipeline
from app.graph.lifecycle_graph import run_lifecycle_pipeline
from app.graph.autonomous_resolution import run_autonomous_resolution, run_autonomous_step_resolution

router = APIRouter()


def _complaint_to_response(c: Complaint, db: Session) -> dict:
    """Convert a Complaint ORM object to a full response dict including steps and contact info."""
    trace = None
    if c.reasoning_trace:
        try:
            trace = json.loads(c.reasoning_trace)
        except (json.JSONDecodeError, TypeError):
            trace = []

    steps = db.query(ResolutionStep).filter(ResolutionStep.complaint_id == c.id).order_by(ResolutionStep.id.asc()).all()
    dept_info = get_department_info(c.department_recommended)

    return {
        "id": c.id,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "raw_input_type": c.raw_input_type or "text",
        "transcript": c.transcript,
        "citizen_id": c.citizen_id,
        "citizen_location": c.citizen_location,
        "category": c.category,
        "urgency": c.urgency,
        "sentiment": c.sentiment,
        "summary": c.summary,
        "department_recommended": c.department_recommended,
        "department_confidence": c.department_confidence,
        "is_duplicate_of": c.is_duplicate_of,
        "duplicate_confidence": c.duplicate_confidence,
        "status": c.status,
        "reasoning_trace": trace,
        "resolution_steps": [
            {
                "id": s.id,
                "complaint_id": s.complaint_id,
                "step_text": s.step_text,
                "owner": s.owner,
                "status": s.status,
                "completed_at": s.completed_at,
            }
            for s in steps
        ],
        "department_contact_info": dept_info,
        "draft_department_message": f"Issue reported at {c.citizen_location or 'specified location'}. Ref complaint #{c.id}. Summary: {c.summary or c.transcript[:100]}",
        "draft_citizen_ack": f"Your complaint has been registered as #{c.id} and routed to {c.department_recommended or 'the department'}.",
    }


def _persist_pipeline_result(result: dict, raw_input_type: str, citizen_id: str, citizen_location: str, db: Session) -> Complaint:
    """Helper to persist Complaint, ResolutionStep rows, and initial Timeline entry."""
    complaint = Complaint(
        raw_input_type=raw_input_type,
        transcript=result["transcript"],
        citizen_id=citizen_id.strip() if citizen_id else None,
        citizen_location=citizen_location.strip() if citizen_location else None,
        category=result.get("category"),
        urgency=result.get("urgency"),
        sentiment=result.get("sentiment"),
        summary=result.get("summary"),
        department_recommended=result.get("department"),
        department_confidence=result.get("department_confidence"),
        is_duplicate_of=result.get("duplicate_of_id"),
        duplicate_confidence=result.get("duplicate_confidence"),
        status="new",
        embedding=json.dumps(result.get("embedding")) if result.get("embedding") else None,
        reasoning_trace=json.dumps(result.get("trace", [])),
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    # Persist resolution steps
    steps = result.get("resolution_steps") or [
        {"step": f"Contact {complaint.department_recommended or 'department'} control room", "owner": "department"},
        {"step": f"Dispatch field crew to {complaint.citizen_location or 'location'}", "owner": "department"},
        {"step": "Confirm resolution and close ticket", "owner": "officer"},
    ]
    for step_data in steps:
        step = ResolutionStep(
            complaint_id=complaint.id,
            step_text=step_data.get("step", ""),
            owner=step_data.get("owner", "officer"),
            status="pending",
        )
        db.add(step)

    # Initial citizen acknowledgment timeline entry (auto-visible)
    ack_msg = result.get("draft_citizen_ack") or (
        f"We've received your complaint regarding {complaint.category or 'the issue'} at "
        f"{complaint.citizen_location or 'your location'} and forwarded it to {complaint.department_recommended or 'the department'}."
    )
    initial_timeline = ComplaintTimelineEntry(
        complaint_id=complaint.id,
        actor="system",
        message=ack_msg,
        visible_to_citizen=True,
    )
    db.add(initial_timeline)
    db.commit()
    db.refresh(complaint)

    return complaint


@router.post("/analyze", response_model=ComplaintResponse)
def analyze_complaint(
    req: ComplaintAnalyzeRequest,
    auto_resolve: bool = False,
    db: Session = Depends(get_db),
):
    """Run the full AI pipeline on a text complaint, optionally auto-resolving with autonomous agents."""
    if not req.transcript or not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")
    if not req.citizen_location or not req.citizen_location.strip():
        raise HTTPException(status_code=400, detail="Location is required")
    if not req.citizen_id or not req.citizen_id.strip():
        raise HTTPException(status_code=400, detail="Email ID is required")

    # Run the LangGraph pipeline
    result = run_complaint_pipeline(req.transcript, req.citizen_location)
    complaint = _persist_pipeline_result(result, "text", req.citizen_id, req.citizen_location, db)

    # If auto_resolve requested, execute the multi-agent resolution immediately
    if auto_resolve:
        run_autonomous_resolution(complaint.id, db)
        db.refresh(complaint)

    return _complaint_to_response(complaint, db)


@router.post("/analyze-audio", response_model=ComplaintResponse)
def analyze_audio_complaint(
    file: UploadFile = File(...),
    citizen_location: str = Form(...),
    citizen_id: str = Form(...),
    auto_resolve: bool = Form(False),
    db: Session = Depends(get_db),
):
    """Run STT then the full AI pipeline on an audio complaint."""
    try:
        from app.llm_client import client, STT_MODEL
        
        # Run STT
        audio_content = file.file
        transcription = client.audio.transcriptions.create(
            model=STT_MODEL,
            file=("audio.wav", audio_content, file.content_type or "audio/wav"),
        )
        transcript = transcription.text
    except Exception as e:
        raise HTTPException(
            status_code=501,
            detail=f"Speech-to-text is not available: {str(e)}. Please use text input instead.",
        )

    # Run the LangGraph pipeline
    result = run_complaint_pipeline(transcript, citizen_location)
    complaint = _persist_pipeline_result(result, "voice", citizen_id, citizen_location, db)

    if auto_resolve:
        run_autonomous_resolution(complaint.id, db)
        db.refresh(complaint)

    return _complaint_to_response(complaint, db)


@router.get("/", response_model=list[ComplaintListItem])
def list_complaints(
    status: Optional[str] = None,
    category: Optional[str] = None,
    urgency: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List complaints with optional filters."""
    query = db.query(Complaint)

    if status:
        query = query.filter(Complaint.status == status)
    if category:
        query = query.filter(Complaint.category == category)
    if urgency:
        query = query.filter(Complaint.urgency == urgency)
    if department:
        query = query.filter(Complaint.department_recommended == department)

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


@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(complaint_id: int, db: Session = Depends(get_db)):
    """Get full complaint details including reasoning trace, steps, and department info."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    return _complaint_to_response(complaint, db)


@router.get("/{complaint_id}/audit-log", response_model=ComplaintAuditLogResponse)
def get_complaint_audit_log(complaint_id: int, db: Session = Depends(get_db)):
    """Get the full AI Agent audit log and reasoning trace for a complaint."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    raw_trace = []
    if complaint.reasoning_trace:
        try:
            raw_trace = json.loads(complaint.reasoning_trace)
        except (json.JSONDecodeError, TypeError):
            raw_trace = []

    total_duration = sum((step.get("duration_ms", 0.0) or 0.0) for step in raw_trace if isinstance(step, dict))

    return ComplaintAuditLogResponse(
        complaint_id=complaint.id,
        total_steps=len(raw_trace),
        total_duration_ms=round(total_duration, 2),
        created_at=complaint.created_at,
        trace=raw_trace,
    )


@router.patch("/{complaint_id}", response_model=ComplaintResponse)
def update_complaint_status(
    complaint_id: int,
    update: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update complaint status (officer action)."""
    valid_statuses = {"new", "assigned", "in_progress", "resolved"}
    if update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = update.status
    db.commit()
    db.refresh(complaint)

    return _complaint_to_response(complaint, db)


# --- Resolution Steps Endpoints ---

@router.get("/{complaint_id}/resolution-steps", response_model=List[ResolutionStepResponse])
def get_resolution_steps(complaint_id: int, db: Session = Depends(get_db)):
    """List resolution steps for a complaint."""
    steps = db.query(ResolutionStep).filter(ResolutionStep.complaint_id == complaint_id).order_by(ResolutionStep.id.asc()).all()
    return steps


@router.patch("/resolution-steps/{step_id}", response_model=ResolutionDraftResponse)
def update_resolution_step(step_id: int, update: ResolutionStepUpdate, db: Session = Depends(get_db)):
    """
    Mark step done or pending.
    Triggers Graph B (Lifecycle Graph) to generate draft citizen message for officer review.
    Does NOT auto-send to the citizen timeline.
    """
    step = db.query(ResolutionStep).filter(ResolutionStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Resolution step not found")

    step.status = update.status
    if update.status == "done":
        step.completed_at = datetime.utcnow()
    else:
        step.completed_at = None
    db.commit()

    # Trigger Graph B Lifecycle Graph
    lifecycle_res = run_lifecycle_pipeline(
        complaint_id=step.complaint_id,
        action_type="step_completed" if update.status == "done" else "step_reopened",
        step_id=step.id,
    )

    return ResolutionDraftResponse(
        step_id=step.id,
        status=step.status,
        draft_citizen_message=lifecycle_res.get("draft_citizen_message"),
        all_steps_done=lifecycle_res.get("all_steps_done", False),
        draft_closure_message=lifecycle_res.get("draft_closure_message"),
    )


@router.post("/{complaint_id}/auto-resolve", response_model=AutonomousResolutionResponse)
def auto_resolve_complaint(complaint_id: int, db: Session = Depends(get_db)):
    """
    Trigger the Autonomous Multi-Agent Resolution Engine on a complaint.
    Executes all milestones, dispatches work orders, passes QA verification,
    updates status to resolved, and notifies the citizen.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    try:
        result = run_autonomous_resolution(complaint_id, db)
        return AutonomousResolutionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Autonomous resolution failed: {str(e)}")


@router.post("/{complaint_id}/auto-resolve-step/{step_id}", response_model=AutonomousStepResolutionResponse)
def auto_resolve_step(complaint_id: int, step_id: int, db: Session = Depends(get_db)):
    """
    Trigger an autonomous AI agent to execute a specific resolution step on a complaint.
    """
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    try:
        result = run_autonomous_step_resolution(complaint_id, step_id, db)
        return AutonomousStepResolutionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Autonomous step resolution failed: {str(e)}")


# --- Timeline Endpoints ---

@router.get("/{complaint_id}/timeline", response_model=List[ComplaintTimelineEntryResponse])
def get_complaint_timeline(complaint_id: int, citizen_view: bool = False, db: Session = Depends(get_db)):
    """Get complaint timeline entries. If citizen_view is true, filters visible_to_citizen only."""
    query = db.query(ComplaintTimelineEntry).filter(ComplaintTimelineEntry.complaint_id == complaint_id)
    if citizen_view:
        query = query.filter(ComplaintTimelineEntry.visible_to_citizen == True)  # noqa: E712
    entries = query.order_by(ComplaintTimelineEntry.created_at.asc()).all()
    return entries


@router.post("/{complaint_id}/timeline/send", response_model=ComplaintTimelineEntryResponse)
def send_timeline_entry(complaint_id: int, req: TimelineSendRequest, db: Session = Depends(get_db)):
    """Officer-approved message send — persists to ComplaintTimelineEntry."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    entry = ComplaintTimelineEntry(
        complaint_id=complaint_id,
        actor="officer",
        message=req.message,
        visible_to_citizen=req.visible_to_citizen,
    )
    db.add(entry)
    if complaint.status == "new":
        complaint.status = "in_progress"
    db.commit()
    db.refresh(entry)

    return entry


# --- STT Transcription ---

@router.post("/transcribe-chunk")
async def transcribe_chunk(audio: UploadFile = File(...)):
    """Transcribe audio chunk via Navigate Labs STT."""
    try:
        from app.llm_client import client, STT_MODEL

        audio_bytes = await audio.read()
        if len(audio_bytes) < 100:
            return {"text": "", "error": "chunk_too_small"}

        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = audio.filename or "chunk.webm"

        result = client.audio.transcriptions.create(
            model=STT_MODEL,
            file=audio_file,
        )
        return {"text": result.text}
    except Exception as e:
        return {"text": "", "error": "chunk_failed", "detail": str(e)}

