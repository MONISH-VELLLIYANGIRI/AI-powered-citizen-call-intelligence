"""
Complaints API router — analyze, list, detail, update, transcribe.
"""
import io
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Complaint
from app.schemas import (
    ComplaintAnalyzeRequest,
    ComplaintResponse,
    ComplaintListItem,
    ComplaintStatusUpdate,
    TraceStep,
)
from app.graph.build_graph import run_complaint_pipeline

router = APIRouter()


def _complaint_to_response(c: Complaint) -> dict:
    """Convert a Complaint ORM object to a response dict."""
    trace = None
    if c.reasoning_trace:
        try:
            trace = json.loads(c.reasoning_trace)
        except (json.JSONDecodeError, TypeError):
            trace = []
    
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
    }


@router.post("/analyze", response_model=ComplaintResponse)
def analyze_complaint(req: ComplaintAnalyzeRequest, db: Session = Depends(get_db)):
    """Run the full AI pipeline on a text complaint."""
    if not req.transcript or not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")

    # Run the LangGraph pipeline
    result = run_complaint_pipeline(req.transcript, req.citizen_location)

    # Persist to DB
    complaint = Complaint(
        raw_input_type="text",
        transcript=result["transcript"],
        citizen_id=req.citizen_id,
        citizen_location=req.citizen_location,
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

    return _complaint_to_response(complaint)


@router.post("/analyze-audio", response_model=ComplaintResponse)
def analyze_audio_complaint(
    file: UploadFile = File(...),
    citizen_location: Optional[str] = Form(None),
    citizen_id: Optional[str] = Form(None),
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

    # Persist to DB
    complaint = Complaint(
        raw_input_type="voice",
        transcript=result["transcript"],
        citizen_id=citizen_id,
        citizen_location=citizen_location,
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

    return _complaint_to_response(complaint)


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
    """Get full complaint details including reasoning trace."""
    complaint = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    return _complaint_to_response(complaint)


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

    return _complaint_to_response(complaint)


@router.post("/transcribe-chunk")
async def transcribe_chunk(audio: UploadFile = File(...)):
    """
    Transcribe a short audio chunk via Navigate Labs STT.
    Used for pseudo-live transcription during voice recording.
    Returns 200 with empty text on failure (not 500) so the frontend
    doesn't treat a single flaky chunk as fatal.
    """
    try:
        from app.llm_client import client, STT_MODEL

        audio_bytes = await audio.read()
        if len(audio_bytes) < 100:
            # Too small to be meaningful audio
            return {"text": "", "error": "chunk_too_small"}

        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = audio.filename or "chunk.webm"

        result = client.audio.transcriptions.create(
            model=STT_MODEL,
            file=audio_file,
        )
        return {"text": result.text}
    except Exception as e:
        # Don't crash — return empty text so recording continues
        return {"text": "", "error": "chunk_failed", "detail": str(e)}
