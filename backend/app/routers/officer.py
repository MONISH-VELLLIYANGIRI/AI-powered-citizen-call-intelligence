"""
Officer API router — task-oriented queue, filtered views (needs_review, my_active, resolved).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Complaint, ResolutionStep
from app.schemas import OfficerQueueItem

router = APIRouter()


@router.get("/queue", response_model=List[OfficerQueueItem])
def get_officer_queue(
    filter: str = Query("my_active", description="needs_review | my_active | resolved | all"),
    db: Session = Depends(get_db),
):
    """
    Task-oriented officer queue.
    - needs_review: Low confidence (< 0.70) or unconfirmed routing needing manual review
    - my_active: New or In-Progress complaints currently being worked on
    - resolved: Completed complaints
    - all: Full complaint backlog
    """
    query = db.query(Complaint)

    if filter == "needs_review":
        # Confidence gate: low confidence routing or duplicates needing confirmation
        query = query.filter(
            (Complaint.status != "resolved") &
            ((Complaint.department_confidence < 0.70) | (Complaint.is_duplicate_of.isnot(None)))
        )
    elif filter == "my_active":
        query = query.filter(Complaint.status.in_(["new", "assigned", "in_progress"]))
    elif filter == "resolved":
        query = query.filter(Complaint.status == "resolved")

    complaints = query.order_by(Complaint.created_at.desc()).all()

    # Pre-fetch step counts
    results: List[OfficerQueueItem] = []
    for c in complaints:
        steps = db.query(ResolutionStep).filter(ResolutionStep.complaint_id == c.id).all()
        total_steps = len(steps)
        completed_steps = sum(1 for s in steps if s.status == "done")

        results.append(
            OfficerQueueItem(
                id=c.id,
                category=c.category,
                urgency=c.urgency,
                status=c.status,
                department_recommended=c.department_recommended,
                created_at=c.created_at,
                summary=c.summary,
                citizen_location=c.citizen_location,
                department_confidence=c.department_confidence,
                total_steps=total_steps,
                completed_steps=completed_steps,
            )
        )

    return results
