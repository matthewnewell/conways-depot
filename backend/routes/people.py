"""
Demo personas — the "whose seat am I looking from" switcher.

This is not authentication and there is no enforcement anywhere: `GET /people` just hands the
frontend the persona list plus, for each, the projects they're on (with the apps each project
connects to) and the flat union of those apps. The nav switcher stores the chosen persona in
localStorage; the project and application lists use this to default to a "mine" view with an
"all" toggle that hides nothing. See models.Person for the full disclaimer.
"""

from collections import defaultdict

from flask import Blueprint, jsonify

from db import db
from models import Application, HiddenOrgApp, Person, Pin, PinOrder, Project

bp = Blueprint("people", __name__, url_prefix="/api/people")


@bp.get("")
def list_people():
    people = Person.query.order_by(Person.name).all()
    all_projects = Project.query.order_by(Project.name).all()
    all_apps = Application.query.all()
    apps_by_id = {a.id: a for a in all_apps}
    # Every organizational app is pinned by default — see models.HiddenOrgApp — so the base set
    # is computed here, once, rather than per person.
    org_app_ids = {a.id for a in all_apps if a.scope == "organizational"}
    # Pinned Apps' own drag-order — see models.PinOrder — grouped by person once rather than
    # queried fresh inside the loop below.
    order_by_person: dict[str, dict[str, int]] = defaultdict(dict)
    for o in PinOrder.query.all():
        order_by_person[o.person_id][o.application_id] = o.position

    out = []
    for person in people:
        # The admin persona is the "see everything" seat — it stands in for every project and
        # app so any generic "is this mine?" check in the frontend just resolves to yes.
        if person.is_admin:
            member_projects = all_projects
            membership_by_project = {}  # admin isn't a real member of anything — nothing to show
        else:
            member_projects = [m.project for m in person.memberships]
            membership_by_project = {m.project_id: m for m in person.memberships}

        projects = [
            {
                "id": proj.id,
                "name": proj.name,
                "phase": proj.phase,
                "application_ids": sorted({l.application_id for l in proj.app_links}),
                # The Launchpad's membership tag — real free text on file (e.g. "Program
                # Manager"), not a role enum. Admin (and anyone pinned-not-membered, once pins
                # cover projects too) shows null here; the frontend labels that "Admin"/"—".
                "role_label": membership_by_project[proj.id].role_label if proj.id in membership_by_project else None,
                # The one real (if still unenforced) flag — see ProjectMembership's own
                # docstring. False for admin's synthetic entries here; the frontend ORs this
                # with persona.is_admin wherever it gates the member-management controls, the
                # same "admin can do everything" reading every other admin-only affordance uses.
                "can_manage_members": membership_by_project[proj.id].can_manage_members if proj.id in membership_by_project else False,
            }
            for proj in member_projects
        ]
        project_ids = [p["id"] for p in projects]
        application_ids = sorted({aid for p in projects for aid in p["application_ids"]})
        # Effective Pinned Apps = every organizational app this person hasn't explicitly hidden,
        # union whatever project-scope apps they've explicitly pinned. See models.HiddenOrgApp —
        # the merge the Launchpad's old separate "Organizational" section used to do visually,
        # done here instead so there's one list, not two.
        hidden_org_app_ids = {
            h.application_id for h in HiddenOrgApp.query.filter_by(person_id=person.id).all()
        }
        explicit_pin_ids = {p.application_id for p in Pin.query.filter_by(person_id=person.id).all()}
        effective_pinned_ids = (org_app_ids - hidden_org_app_ids) | explicit_pin_ids
        # Drag-ordered apps first, in the order this person put them in; anything never
        # dragged (freshly pinned, a newly-registered org app, a preset just applied) falls in
        # after, alphabetically — stable and predictable rather than the arbitrary id sort this
        # used to be before PinOrder existed.
        person_order = order_by_person.get(person.id, {})
        pinned_application_ids = sorted(
            effective_pinned_ids,
            key=lambda aid: (
                person_order.get(aid, len(person_order)),
                apps_by_id[aid].name if aid in apps_by_id else "",
            ),
        )

        out.append(
            {
                **person.to_dict(),
                "project_ids": project_ids,
                "application_ids": application_ids,
                "pinned_application_ids": pinned_application_ids,
                "projects": projects,
            }
        )
    return jsonify(out)
