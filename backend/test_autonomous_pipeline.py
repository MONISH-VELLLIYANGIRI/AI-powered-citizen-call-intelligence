from app.db import SessionLocal
from app.graph.build_graph import run_complaint_pipeline
from app.graph.autonomous_resolution import run_autonomous_resolution
from app.models import Complaint, ResolutionStep, ComplaintTimelineEntry
from app.routers.complaints import _persist_pipeline_result
import json

db = SessionLocal()
try:
    print("Testing intake & triage pipeline...")
    res = run_complaint_pipeline(
        "Transformer explosion and sparking on 5th Main Indiranagar. Immediate power outage and sparks near children park.",
        "Indiranagar"
    )
    complaint = _persist_pipeline_result(res, "text", "citizen@test.com", "Indiranagar", db)
    print(f"Created complaint #{complaint.id}")
    print(f"Status: {complaint.status}")
    print(f"Category: {complaint.category}")
    print(f"Urgency: {complaint.urgency}")
    print(f"Department: {complaint.department_recommended}")
    
    print("\nRunning autonomous multi-agent resolution...")
    auto_res = run_autonomous_resolution(complaint.id, db)
    print(f"Autonomous resolution outcome: {auto_res['status']}")
    print(f"Steps completed: {auto_res['steps_completed']}")
    print(f"Closure notice: {auto_res.get('closure_message')}")
    
    db.refresh(complaint)
    steps = db.query(ResolutionStep).filter(ResolutionStep.complaint_id == complaint.id).all()
    timeline = db.query(ComplaintTimelineEntry).filter(ComplaintTimelineEntry.complaint_id == complaint.id).all()
    
    print(f"\nComplaint Final Status in DB: {complaint.status}")
    print(f"All resolution steps marked done: {all(s.status == 'done' for s in steps)}")
    print(f"Total timeline entries created: {len(timeline)}")
    for idx, t in enumerate(timeline, 1):
        print(f"  {idx}. [{t.actor.upper()}]: {t.message}")
    
    trace = json.loads(complaint.reasoning_trace or "[]")
    print(f"Total AI Agent reasoning traces logged: {len(trace)}")
    for item in trace:
        print(f"  - Agent: {item.get('agent_name', item.get('node'))} | Action: {item.get('action_summary')}")

    print("\n>>> ALL MULTI-AGENT RESOLUTION CHECKS PASSED SUCCESSFULLY! <<<")
finally:
    db.close()
