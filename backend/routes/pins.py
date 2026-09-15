"""
Pins — Person <-> Application, the Launchpad's "Pinned Apps" section. See models.Pin and
models.HiddenOrgApp for why there are two tables under one API: an organizational-scope app is
pinned by default for everyone, so "pinning" one that's already showing is a no-op and
"unpinning" one actually records a HiddenOrgApp exception instead of a Pin row. A project-scope
app works exactly as before — Pin's own presence is the only signal. The frontend never needs
to know which table a given call actually touches; it always just POSTs or DELETEs a pin.
"""

from flask import Blueprint, jsonify, request

from db import db
from models import Application, HiddenOrgApp, Person, Pin, PinOrder
from presets import PRESETS

bp = Blueprint("pins", __name__, url_prefix="/api/pins")


@bp.get("")
def list_pins():
    q = Pin.query
    if person_id := request.args.get("person_id"):
        q = q.filter_by(person_id=person_id)
    pins = q.order_by(Pin.created_at).all()
    return jsonify([p.to_dict() for p in pins])


@bp.get("/presets")
def list_presets():
    """The Launchpad's preset dropdown — see presets.py for what these are and aren't (not a
    role system, just a handful of hardcoded starting points). Resolves each preset's app
    names to live ids here so the frontend never has to know an app's id ahead of time; an
    app name not currently registered is silently skipped, same tolerance seed.py's own
    _ADMIN_PINS already has."""
    apps_by_name = {a.name: a for a in Application.query.all()}
    out = []
    for key, preset in PRESETS.items():
        apps = [apps_by_name[n] for n in preset["app_names"] if n in apps_by_name]
        out.append({
            "key": key,
            "label": preset["label"],
            "description": preset["description"],
            "application_ids": [a.id for a in apps],
        })
    return jsonify(out)


@bp.post("/apply-preset")
def apply_preset():
    """Apply a preset outright — the person's pinned set becomes exactly what the preset
    names, replacing whatever they had (not a merge). "Default" (all 7 organizational apps,
    nothing else) is the same state a persona starts in, so this doubles as the Launchpad's
    reset-my-pins action rather than needing a separate one."""
    body = request.get_json(force=True) or {}
    person_id = body.get("person_id")
    preset_key = body.get("preset")

    person = Person.query.get(person_id) if person_id else None
    if person is None:
        return jsonify({"error": "person_id does not refer to a real person"}), 400
    preset = PRESETS.get(preset_key)
    if preset is None:
        return jsonify({"error": f"preset must be one of {sorted(PRESETS)}"}), 400

    target_apps = Application.query.filter(Application.name.in_(preset["app_names"])).all()
    target_org_ids = {a.id for a in target_apps if a.scope == "organizational"}
    target_project_ids = {a.id for a in target_apps if a.scope != "organizational"}

    # Organizational: hide every one not in the target set, un-hide every one that is.
    all_org_ids = {a.id for a in Application.query.filter_by(scope="organizational").all()}
    hidden_by_app = {
        h.application_id: h for h in HiddenOrgApp.query.filter_by(person_id=person.id).all()
    }
    for app_id in all_org_ids:
        wants_visible = app_id in target_org_ids
        is_hidden = app_id in hidden_by_app
        if wants_visible and is_hidden:
            db.session.delete(hidden_by_app[app_id])
        elif not wants_visible and not is_hidden:
            db.session.add(HiddenOrgApp(person_id=person.id, application_id=app_id))

    # Project-scope: reconcile explicit Pin rows against the target set.
    existing_pins = {p.application_id: p for p in Pin.query.filter_by(person_id=person.id).all()}
    for app_id in target_project_ids:
        if app_id not in existing_pins:
            db.session.add(Pin(person_id=person.id, application_id=app_id))
    for app_id, pin in existing_pins.items():
        if app_id not in target_project_ids:
            db.session.delete(pin)

    db.session.commit()
    return jsonify({"person_id": person.id, "preset": preset_key}), 200


def _require_person_and_app(person_id, application_id):
    if not person_id or not application_id:
        return None, None, ({"error": "person_id and application_id are required"}, 400)
    person = Person.query.get(person_id)
    if person is None:
        return None, None, ({"error": "person_id does not refer to a real person"}, 400)
    app = Application.query.get(application_id)
    if app is None:
        return None, None, ({"error": "application_id does not refer to a real application"}, 400)
    return person, app, None


@bp.post("")
def create_pin():
    """"Pin" for a project-scope app = create a Pin row, same as always. For an organizational
    app — pinned by default — this means "put it back," i.e. clear any HiddenOrgApp exception;
    there is never a Pin row for an organizational app to begin with."""
    body = request.get_json(force=True) or {}
    person, app, err = _require_person_and_app(body.get("person_id"), body.get("application_id"))
    if err:
        return jsonify(err[0]), err[1]

    if app.scope == "organizational":
        hidden = HiddenOrgApp.query.filter_by(person_id=person.id, application_id=app.id).first()
        if hidden:
            db.session.delete(hidden)
            db.session.commit()
        return jsonify({"person_id": person.id, "application_id": app.id, "pinned": True}), 200

    # Idempotent — pinning something already pinned just returns the existing row, not a
    # duplicate (the unique constraint would reject a second insert anyway).
    existing = Pin.query.filter_by(person_id=person.id, application_id=app.id).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    pin = Pin(person_id=person.id, application_id=app.id)
    db.session.add(pin)
    db.session.commit()
    return jsonify(pin.to_dict()), 201


@bp.delete("")
def delete_pin():
    """Unpin by (person_id, application_id) — query params, not a pin id, since the frontend
    always knows those two and never needs to look up the pin's own id first. For an
    organizational app this records a HiddenOrgApp exception instead of deleting a Pin row —
    there isn't one to delete."""
    person, app, err = _require_person_and_app(
        request.args.get("person_id"), request.args.get("application_id")
    )
    if err:
        return jsonify(err[0]), err[1]

    if app.scope == "organizational":
        existing = HiddenOrgApp.query.filter_by(person_id=person.id, application_id=app.id).first()
        if existing is None:
            db.session.add(HiddenOrgApp(person_id=person.id, application_id=app.id))
            db.session.commit()
        return "", 204

    pin = Pin.query.filter_by(person_id=person.id, application_id=app.id).first()
    if pin is None:
        return "", 204  # already not pinned — unpinning is idempotent too
    db.session.delete(pin)
    db.session.commit()
    return "", 204


@bp.put("/order")
def reorder_pins():
    """Save a drag-reorder of the Launchpad's Pinned Apps grid — see models.PinOrder. Body:
    {person_id, application_ids: [...]} in the exact order they should render. Full replace,
    not a per-item move: deletes every existing PinOrder row for this person and recreates one
    per app at its index in the list. An app the caller leaves out of the list just loses its
    stored position (falls back to sorting after everything positioned, by name) rather than
    erroring — reordering a subset makes sense if a future UI only shows part of the grid."""
    body = request.get_json(force=True) or {}
    person_id = body.get("person_id")
    application_ids = body.get("application_ids")

    person = Person.query.get(person_id) if person_id else None
    if person is None:
        return jsonify({"error": "person_id does not refer to a real person"}), 400
    if not isinstance(application_ids, list) or not application_ids:
        return jsonify({"error": "application_ids must be a non-empty list"}), 400
    known_ids = {
        a.id for a in Application.query.filter(Application.id.in_(application_ids)).all()
    }
    unknown = [aid for aid in application_ids if aid not in known_ids]
    if unknown:
        return jsonify({"error": f"application_ids contains unknown app ids: {unknown}"}), 400

    PinOrder.query.filter_by(person_id=person.id).filter(
        PinOrder.application_id.in_(application_ids)
    ).delete(synchronize_session=False)
    for i, app_id in enumerate(application_ids):
        db.session.add(PinOrder(person_id=person.id, application_id=app_id, position=i))
    db.session.commit()
    return "", 204
