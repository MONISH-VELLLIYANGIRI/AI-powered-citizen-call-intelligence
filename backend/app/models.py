from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
from app.db import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Input
    raw_input_type = Column(String, default="text")  # "voice" | "text"
    transcript = Column(Text, nullable=False)
    citizen_id = Column(String, nullable=True)
    citizen_location = Column(String, nullable=True)

    # AI Classification
    category = Column(String, nullable=True)  # electricity|water|roads|police|health|transport|sanitation|other
    urgency = Column(String, nullable=True)   # emergency|high|normal|low
    sentiment = Column(String, nullable=True) # negative|neutral|positive
    summary = Column(Text, nullable=True)

    # Department Routing
    department_recommended = Column(String, nullable=True)
    department_confidence = Column(Float, nullable=True)

    # Duplicate Detection
    is_duplicate_of = Column(Integer, ForeignKey("complaints.id"), nullable=True)
    duplicate_confidence = Column(Float, nullable=True)

    # Status
    status = Column(String, default="new")  # new|assigned|in_progress|resolved

    # Embedding (JSON-serialized float list)
    embedding = Column(Text, nullable=True)

    # Reasoning Trace (JSON-serialized list of {node, output, duration_ms})
    reasoning_trace = Column(Text, nullable=True)


class ResolutionStep(Base):
    __tablename__ = "resolution_steps"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    step_text = Column(String, nullable=False)
    owner = Column(String, default="officer")  # "department" | "officer"
    status = Column(String, default="pending")  # "pending" | "done"
    completed_at = Column(DateTime, nullable=True)


class ComplaintTimelineEntry(Base):
    __tablename__ = "complaint_timeline_entries"

    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=False, index=True)
    actor = Column(String, default="system")  # "system" | "officer" | "citizen"
    message = Column(Text, nullable=False)
    visible_to_citizen = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

