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
from models import Application, HiddenOrgApp, Person, Pin

bp = Blueprint("pins", __name__, url_prefix="/api/pins")


@bp.get("")
def list_pins():
    q = Pin.query
    if person_id := request.args.get("person_id"):
        q = q.filter_by(person_id=person_id)
    pins = q.order_by(Pin.created_at).all()
    return jsonify([p.to_dict() for p in pins])


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
