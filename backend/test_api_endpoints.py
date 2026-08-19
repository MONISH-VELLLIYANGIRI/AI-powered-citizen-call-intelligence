import urllib.request
import json

def get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def patch(url, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="PATCH")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def post(url, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

print("--- Testing API Endpoints ---")
officer_active = get("http://localhost:8000/api/officer/queue?filter=my_active")
print(f"1. Officer active queue count: {len(officer_active)}")

officer_review = get("http://localhost:8000/api/officer/queue?filter=needs_review")
print(f"2. Officer needs review count: {len(officer_review)}")

citizen_list = get("http://localhost:8000/api/citizen/complaints")
print(f"3. Citizen complaints list count: {len(citizen_list)}")

first_id = citizen_list[0]["id"]
citizen_detail = get(f"http://localhost:8000/api/citizen/complaints/{first_id}")
print(f"4. Citizen detail #{first_id}: category={citizen_detail.get('category')}, steps={len(citizen_detail.get('steps_summary', []))}, timeline={len(citizen_detail.get('timeline', []))}")

# Test citizen follow-up
followup_res = post(f"http://localhost:8000/api/citizen/complaints/{first_id}/followup", {"message": "Has the crew arrived yet?"})
print(f"5. Citizen follow-up posted: id={followup_res.get('id')}, actor={followup_res.get('actor')}")

# Test timeline officer send
officer_send_res = post(f"http://localhost:8000/api/complaints/{first_id}/timeline/send", {"message": "Field team is on site.", "visible_to_citizen": True})
print(f"6. Officer update sent: id={officer_send_res.get('id')}, actor={officer_send_res.get('actor')}")

# Test Audit Log endpoint
audit_log_res = get(f"http://localhost:8000/api/complaints/{first_id}/audit-log")
print(f"7. Audit log #{first_id}: total_steps={audit_log_res.get('total_steps')}, duration={audit_log_res.get('total_duration_ms')}ms")
if audit_log_res.get("trace"):
    first_step = audit_log_res["trace"][0]
    print(f"   First agent: {first_step.get('agent_name')} | summary: {first_step.get('action_summary')}")

print("\nAll endpoints tested and working!")
