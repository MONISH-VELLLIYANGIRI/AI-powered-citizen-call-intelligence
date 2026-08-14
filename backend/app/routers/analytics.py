"""
Analytics API router — summary stats, hotspots.
"""
from datetime import datetime, timedelta
from collections import Counter
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.models import Complaint
from app.schemas import AnalyticsSummary, HotspotItem

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    """Aggregated complaint statistics."""
    complaints = db.query(Complaint).all()
    total = len(complaints)

    # By category
    by_category = Counter(c.category or "other" for c in complaints)

    # By urgency
    by_urgency = Counter(c.urgency or "normal" for c in complaints)

    # By status
    by_status = Counter(c.status or "new" for c in complaints)

    # Avg resolution hours (for resolved complaints)
    resolved = [c for c in complaints if c.status == "resolved" and c.created_at and c.updated_at]
    if resolved:
        total_hours = sum(
            (c.updated_at - c.created_at).total_seconds() / 3600
            for c in resolved
        )
        avg_resolution_hours = round(total_hours / len(resolved), 1)
    else:
        avg_resolution_hours = None

    # Trend last 14 days
    today = datetime.utcnow().date()
    trend = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        count = sum(
            1 for c in complaints
            if c.created_at and c.created_at.date() == day
        )
        trend.append({"date": day.isoformat(), "count": count})

    return AnalyticsSummary(
        total=total,
        by_category=dict(by_category),
        by_urgency=dict(by_urgency),
        by_status=dict(by_status),
        avg_resolution_hours=avg_resolution_hours,
        trend_last_14_days=trend,
    )


@router.get("/hotspots", response_model=list[HotspotItem])
def get_hotspots(db: Session = Depends(get_db)):
    """Location + category groupings sorted by complaint count."""
    complaints = db.query(Complaint).filter(
        Complaint.citizen_location.isnot(None),
        Complaint.citizen_location != "",
    ).all()

    # Group by location + category
    groups = Counter(
        (c.citizen_location, c.category or "other")
        for c in complaints
    )

    hotspots = [
        HotspotItem(location=loc, category=cat, count=count)
        for (loc, cat), count in groups.most_common(50)
    ]

    return hotspots
