"""
Chatbot API router — citizen complaint status queries.
Uses template-based responses for reliability (LLM upgrade is stretch goal).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Complaint
from app.schemas import ChatbotQueryRequest, ChatbotResponse

router = APIRouter()


def _format_complaint_status(c: Complaint) -> str:
    """Generate a natural-language status message from a complaint."""
    status_map = {
        "new": "has been received and is awaiting assignment",
        "assigned": "has been assigned to the appropriate department",
        "in_progress": "is currently being worked on",
        "resolved": "has been resolved",
    }
    status_text = status_map.get(c.status, f"has status: {c.status}")

    parts = [f"Your complaint (#{c.id})"]
    if c.category:
        parts.append(f"regarding {c.category}")
    parts.append(status_text)
    if c.department_recommended:
        parts.append(f"and is handled by the {c.department_recommended}")
    msg = " ".join(parts) + "."

    if c.summary:
        msg += f"\n\nSummary: {c.summary}"

    if c.urgency == "emergency":
        msg += "\n\n⚠️ This has been flagged as an emergency and is being prioritized."
    
    return msg


@router.post("/query", response_model=ChatbotResponse)
def chatbot_query(req: ChatbotQueryRequest, db: Session = Depends(get_db)):
    """Answer citizen queries about complaint status."""
    complaints = []

    # Look up by complaint ID
    if req.complaint_id:
        c = db.query(Complaint).filter(Complaint.id == req.complaint_id).first()
        if c:
            complaints.append(c)

    # Look up by citizen ID
    if req.citizen_id and not complaints:
        complaints = db.query(Complaint).filter(
            Complaint.citizen_id == req.citizen_id
        ).order_by(Complaint.created_at.desc()).limit(5).all()

    # Try to extract complaint ID from query text if no explicit ID given
    if not complaints and not req.complaint_id and not req.citizen_id:
        import re
        match = re.search(r"#?(\d+)", req.query)
        if match:
            cid = int(match.group(1))
            c = db.query(Complaint).filter(Complaint.id == cid).first()
            if c:
                complaints.append(c)

    if not complaints:
        return ChatbotResponse(
            answer="I couldn't find any complaints matching your query. "
                   "Please provide a valid complaint ID (e.g., 'What is the status of complaint #27?') "
                   "or your citizen ID to look up your complaints."
        )

    if len(complaints) == 1:
        answer = _format_complaint_status(complaints[0])
    else:
        answer = f"I found {len(complaints)} complaints associated with your account:\n\n"
        for c in complaints:
            answer += f"• #{c.id} ({c.category or 'general'}) — {c.status}"
            if c.department_recommended:
                answer += f" — {c.department_recommended}"
            answer += "\n"
        answer += "\nPlease specify a complaint ID for more details."

    return ChatbotResponse(answer=answer)
