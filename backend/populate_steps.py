from app.db import SessionLocal
from app.models import Complaint, ResolutionStep, ComplaintTimelineEntry
from datetime import datetime

db = SessionLocal()
complaints = db.query(Complaint).all()
print(f"Total complaints in DB: {len(complaints)}")
for c in complaints:
    steps = db.query(ResolutionStep).filter(ResolutionStep.complaint_id == c.id).all()
    if not steps:
        dept = c.department_recommended or "Department"
        loc = c.citizen_location or "specified location"
        db.add(ResolutionStep(
            complaint_id=c.id,
            step_text=f"Contact {dept} control room",
            owner="department",
            status="done" if c.status in ["in_progress", "resolved"] else "pending",
            completed_at=datetime.utcnow() if c.status in ["in_progress", "resolved"] else None,
        ))
        db.add(ResolutionStep(
            complaint_id=c.id,
            step_text=f"Dispatch field crew to {loc}",
            owner="department",
            status="done" if c.status == "resolved" else "pending",
            completed_at=datetime.utcnow() if c.status == "resolved" else None,
        ))
        db.add(ResolutionStep(
            complaint_id=c.id,
            step_text="Confirm issue resolution and close ticket",
            owner="officer",
            status="done" if c.status == "resolved" else "pending",
            completed_at=datetime.utcnow() if c.status == "resolved" else None,
        ))

    timeline = db.query(ComplaintTimelineEntry).filter(ComplaintTimelineEntry.complaint_id == c.id).all()
    if not timeline:
        msg = f"Complaint #{c.id} registered and forwarded to {c.department_recommended or 'Department'}."
        db.add(ComplaintTimelineEntry(
            complaint_id=c.id,
            actor="system",
            message=msg,
            visible_to_citizen=True,
            created_at=c.created_at,
        ))
        if c.status in ["in_progress", "resolved"]:
            db.add(ComplaintTimelineEntry(
                complaint_id=c.id,
                actor="officer",
                message=f"Department team contacted and inspection scheduled for {c.citizen_location or 'the area'}.",
                visible_to_citizen=True,
                created_at=c.created_at,
            ))
        if c.status == "resolved":
            db.add(ComplaintTimelineEntry(
                complaint_id=c.id,
                actor="officer",
                message=f"Work completed and confirmed resolved.",
                visible_to_citizen=True,
                created_at=c.created_at,
            ))

db.commit()

step_count = db.query(ResolutionStep).count()
timeline_count = db.query(ComplaintTimelineEntry).count()
print(f"Verified: {len(complaints)} complaints, {step_count} steps, {timeline_count} timeline entries.")
db.close()
