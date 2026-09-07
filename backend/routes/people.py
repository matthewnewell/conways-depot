"""
Demo personas — the "whose seat am I looking from" switcher.

This is not authentication and there is no enforcement anywhere: `GET /people` just hands the
frontend the persona list plus, for each, the projects they're on (with the apps each project
connects to) and the flat union of those apps. The nav switcher stores the chosen persona in
localStorage; the project and application lists use this to default to a "mine" view with an
"all" toggle that hides nothing. See models.Person for the full disclaimer.
"""

from flask import Blueprint, jsonify

from db import db
from models import Person, Project

bp = Blueprint("people", __name__, url_prefix="/api/people")


@bp.get("")
def list_people():
    people = Person.query.order_by(Person.name).all()
    all_projects = Project.query.order_by(Project.name).all()

    out = []
    for person in people:
        # The admin persona is the "see everything" seat — it stands in for every project and
        # app so any generic "is this mine?" check in the frontend just resolves to yes.
        if person.is_admin:
            member_projects = all_projects
        else:
            member_projects = [m.project for m in person.memberships]

        projects = [
            {
                "id": proj.id,
                "name": proj.name,
                "phase": proj.phase,
                "application_ids": sorted({l.application_id for l in proj.app_links}),
            }
            for proj in member_projects
        ]
        project_ids = [p["id"] for p in projects]
        application_ids = sorted({aid for p in projects for aid in p["application_ids"]})

        out.append(
            {
                **person.to_dict(),
                "project_ids": project_ids,
                "application_ids": application_ids,
                "projects": projects,
            }
        )
    return jsonify(out)
