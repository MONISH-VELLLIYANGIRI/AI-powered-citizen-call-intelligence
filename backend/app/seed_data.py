"""
Seed the database with 22 demo complaints.
Each complaint runs through the actual LangGraph pipeline for consistency.
Run: python -m app.seed_data (from backend/ directory)
"""
import json
import random
from datetime import datetime, timedelta

from app.db import SessionLocal, create_tables
from app.models import Complaint
from app.graph.build_graph import run_complaint_pipeline


# 22 seed complaints — 4 near-duplicate pairs, 2-3 emergencies, spread across categories
SEED_COMPLAINTS = [
    # --- Electricity (4, including 1 duplicate pair + 1 emergency) ---
    {"transcript": "Power has been out on MG Road since morning. All the shops and houses are without electricity.", "location": "MG Road", "days_ago": 1},
    {"transcript": "No electricity in MG road area for the past few hours. Even the streetlights are off.", "location": "MG Road", "days_ago": 0},  # duplicate of above
    {"transcript": "Live wire fallen on the road near the government school. Children walking past it every morning. Extremely dangerous situation.", "location": "Tambaram", "days_ago": 3},  # EMERGENCY
    {"transcript": "Frequent power cuts in our area, at least 4-5 times daily. Voltage fluctuation damaging home appliances.", "location": "Velachery", "days_ago": 7},

    # --- Water (4, including 1 duplicate pair) ---
    {"transcript": "There's been no water supply on Anna Nagar 4th street for 5 days. Senior citizens and children are suffering.", "location": "Anna Nagar", "days_ago": 2},
    {"transcript": "Water not coming in Anna Nagar 4th street since almost a week now. We are buying water tankers daily.", "location": "Anna Nagar", "days_ago": 1},  # duplicate of above
    {"transcript": "The drinking water has a brown color and foul smell in our area. We suspect contamination from the nearby construction site.", "location": "T. Nagar", "days_ago": 5},
    {"transcript": "Water pipeline burst on 2nd Main Road. Water flowing on the road for 3 days and nobody from the corporation has come.", "location": "Adyar", "days_ago": 10},

    # --- Roads (4, including 1 duplicate pair) ---
    {"transcript": "Huge pothole near the bus stop on Anna Salai causing accidents. Two-wheelers keep skidding especially when it rains.", "location": "Anna Salai", "days_ago": 4},
    {"transcript": "Dangerous pothole outside Anna Salai bus stop. Two auto rickshaws got damaged yesterday. Someone will die if this is not fixed.", "location": "Anna Salai", "days_ago": 3},  # duplicate of above
    {"transcript": "The entire stretch of road from Guindy signal to Kathipara junction is broken. Full of potholes and no streetlights working.", "location": "Guindy", "days_ago": 8},
    {"transcript": "Illegal construction blocking half the road on Poonamallee High Road. Traffic jam every evening for hours.", "location": "Poonamallee", "days_ago": 6},

    # --- Police/Safety (3, including 1 emergency) ---
    {"transcript": "Gas leak smell reported near the residential building on 3rd Cross Street. Multiple families have evacuated. Need immediate help.", "location": "Mylapore", "days_ago": 0},  # EMERGENCY
    {"transcript": "Repeated chain snatching incidents in our locality. Three cases in the last week alone. Women are afraid to go out.", "location": "Kodambakkam", "days_ago": 5},
    {"transcript": "Loud noise and illegal parties happening every night at the commercial building on 5th Avenue. No peace after 11 PM.", "location": "Besant Nagar", "days_ago": 9},

    # --- Health (2) ---
    {"transcript": "Stagnant water near the community center breeding mosquitoes. Multiple dengue cases reported in our street this month.", "location": "Chrompet", "days_ago": 11},
    {"transcript": "The public health center on Trunk Road has no medicines available. Patients are being turned away daily.", "location": "Ambattur", "days_ago": 7},

    # --- Transport (3, including 1 duplicate pair) ---
    {"transcript": "Bus route 27B has been cancelled without notice. Thousands of daily commuters including school children are stranded.", "location": "Tambaram", "days_ago": 2},
    {"transcript": "Route 27B bus service stopped suddenly. No alternative transport available for our area. Students missing school.", "location": "Tambaram", "days_ago": 1},  # duplicate of above
    {"transcript": "The traffic signal at Vadapalani junction has been non-functional for over a week. Causing major traffic jams and near-misses.", "location": "Vadapalani", "days_ago": 12},

    # --- Sanitation (2) ---
    {"transcript": "Garbage not collected from our street for the past 10 days. The pile is huge and dogs are scattering waste everywhere.", "location": "Perambur", "days_ago": 4},
    {"transcript": "Open drain overflowing on the main road in Royapettah. Sewage water entering houses during rain.", "location": "Royapettah", "days_ago": 13},
]

# Pre-assigned statuses for variety (30-40% non-"new")
STATUS_OVERRIDES = {
    2: "assigned",
    4: "in_progress",
    7: "resolved",
    8: "assigned",
    10: "resolved",
    11: "in_progress",
    14: "resolved",
    16: "assigned",
    19: "in_progress",
    21: "resolved",
}


def seed_database():
    """Populate the database with demo complaints run through the real pipeline."""
    create_tables()
    db = SessionLocal()

    try:
        # Clear existing to guarantee a clean, full 22-complaint demo dataset
        print("Clearing existing complaints database...")
        db.query(Complaint).delete()
        db.commit()

        print(f"Seeding {len(SEED_COMPLAINTS)} complaints through the AI pipeline...")
        print("=" * 60)

        for i, seed in enumerate(SEED_COMPLAINTS):
            print(f"\n[{i+1}/{len(SEED_COMPLAINTS)}] Processing: {seed['transcript'][:80]}...")

            try:
                # Run through the actual pipeline
                result = run_complaint_pipeline(seed["transcript"], seed["location"])

                # Calculate created_at timestamp
                created_at = datetime.utcnow() - timedelta(days=seed["days_ago"], hours=random.randint(0, 12), minutes=random.randint(0, 59))

                # Determine status
                status = STATUS_OVERRIDES.get(i, "new")

                # Create complaint record
                complaint = Complaint(
                    created_at=created_at,
                    updated_at=created_at + timedelta(hours=random.randint(1, 48)) if status != "new" else created_at,
                    raw_input_type="text",
                    transcript=result["transcript"],
                    citizen_id=f"CIT-{random.randint(1000, 9999)}",
                    citizen_location=seed["location"],
                    category=result.get("category"),
                    urgency=result.get("urgency"),
                    sentiment=result.get("sentiment"),
                    summary=result.get("summary"),
                    department_recommended=result.get("department"),
                    department_confidence=result.get("department_confidence"),
                    is_duplicate_of=result.get("duplicate_of_id"),
                    duplicate_confidence=result.get("duplicate_confidence"),
                    status=status,
                    embedding=json.dumps(result.get("embedding")) if result.get("embedding") else None,
                    reasoning_trace=json.dumps(result.get("trace", [])),
                )
                db.add(complaint)
                db.commit()

                urgency_icon = "🔴" if result.get("urgency") == "emergency" else "🟡" if result.get("urgency") == "high" else "🔵"
                dup_tag = " [DUPLICATE]" if result.get("is_duplicate") else ""
                print(f"  {urgency_icon} Category: {result.get('category')} | Urgency: {result.get('urgency')} | Dept: {result.get('department')} | Status: {status}{dup_tag}")

            except Exception as e:
                print(f"  ❌ ERROR processing complaint: {e}")
                db.rollback()
                continue

        final_count = db.query(Complaint).count()
        print(f"\n{'=' * 60}")
        print(f"✅ Seeding complete. {final_count} complaints in database.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
