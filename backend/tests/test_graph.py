"""
Quick manual test script for the LangGraph pipeline.
Run: python -m tests.test_graph (from backend/ directory)
"""
import json
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.graph.build_graph import run_complaint_pipeline


TEST_CASES = [
    {
        "name": "Emergency - Live wire",
        "transcript": "There is a live electric wire dangling on the street near the primary school. Kids are walking past it. This is extremely dangerous!",
        "location": "Tambaram",
    },
    {
        "name": "Water supply issue",
        "transcript": "We have not had water supply for the past 3 days in our area. The overhead tank is empty and we are buying water from tankers.",
        "location": "Anna Nagar",
    },
    {
        "name": "Road pothole",
        "transcript": "There is a huge pothole on the main road near the bus stop. Several bikes have fallen. It needs immediate repair before someone gets seriously hurt.",
        "location": "Anna Salai",
    },
    {
        "name": "Bus service complaint",
        "transcript": "The bus number 47A which used to run from Tambaram to T.Nagar has been stopped since last week. Many office goers depend on this route.",
        "location": "Tambaram",
    },
]


def run_tests():
    print("=" * 70)
    print("LangGraph Pipeline Test - Running sample complaints")
    print("=" * 70)

    for i, test in enumerate(TEST_CASES):
        print("")
        print("-" * 70)
        print(f"TEST {i+1}: {test['name']}")
        print(f"Transcript: {test['transcript'][:100]}...")
        print("-" * 70)

        try:
            result = run_complaint_pipeline(test["transcript"], test["location"])

            print(f"  Category:    {result.get('category')}")
            print(f"  Urgency:     {result.get('urgency')}")
            print(f"  Sentiment:   {result.get('sentiment')}")
            print(f"  Department:  {result.get('department')} (confidence: {result.get('department_confidence')})")
            print(f"  Summary:     {result.get('summary')}")
            print(f"  Duplicate:   {result.get('is_duplicate')} (of: {result.get('duplicate_of_id')})")
            print(f"")
            print(f"  TRACE ({len(result.get('trace', []))} nodes):")
            for step in result.get("trace", []):
                node = step.get("node", "?")
                duration = step.get("duration_ms", 0)
                output_preview = json.dumps(step.get("output", {}))[:120]
                fallback = " [FALLBACK]" if step.get("fallback_used") else ""
                print(f"    -> {node} ({duration:.0f}ms){fallback}: {output_preview}")

            print(f"")
            print(f"  PASS")
        except Exception as e:
            print(f"")
            print(f"  FAIL: {e}")
            import traceback
            traceback.print_exc()

    print("")
    print("=" * 70)
    print("Test run complete.")


if __name__ == "__main__":
    run_tests()
