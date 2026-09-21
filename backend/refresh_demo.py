"""Re-apply the demo story (personas, roles, pins, projects, links, journal history) to the
CURRENT database. Idempotent — safe to run repeatedly. Replaces the demo personas' memberships,
pins and hidden apps with the sets in demo_data.py; leaves any other data alone.

    cd backend && .venv/bin/python refresh_demo.py
"""

from app import create_app
from demo_data import apply_demo_data

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        print(apply_demo_data())
