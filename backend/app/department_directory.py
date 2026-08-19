"""
Department directory with static contact details, email, and SLA hours.
Used deterministically by resolution planner and officer dashboard.
"""

DEPARTMENT_DIRECTORY = {
    "Electricity Board": {"contact": "1912", "email": "grievance@electricityboard.gov.in", "sla_hours": 24},
    "Water Department": {"contact": "1916", "email": "grievance@waterboard.gov.in", "sla_hours": 48},
    "Roads & Municipal": {"contact": "1913", "email": "roads@municipal.gov.in", "sla_hours": 72},
    "Police Control Room": {"contact": "100", "email": None, "sla_hours": 2},
    "Health Services": {"contact": "104", "email": "health@services.gov.in", "sla_hours": 12},
    "Transport Authority": {"contact": "1915", "email": "transport@authority.gov.in", "sla_hours": 48},
    "Disaster Management": {"contact": "108", "email": None, "sla_hours": 1},
    "General/Other": {"contact": "1800-XXX-XXXX", "email": "grievance@gov.in", "sla_hours": 72},
}


def get_department_info(department: str) -> dict:
    """Retrieve contact details and SLA for a given department."""
    if not department:
        return DEPARTMENT_DIRECTORY["General/Other"]
    return DEPARTMENT_DIRECTORY.get(department, DEPARTMENT_DIRECTORY["General/Other"])
