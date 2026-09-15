"""
Pins — Person ↔ Application, the Launchpad's "Pinned Apps" section. See models.Pin for why this
is its own table rather than derived from anything else.
"""

from flask import Blueprint, jsonify, request

from db import db
from models import Application, Person, Pin

bp = Blueprint("pins", __name__, url_prefix="/api/pins")


@bp.get("")
def list_pins():
    q = Pin.query
    if person_id := request.args.get("person_id"):
        q = q.filter_by(person_id=person_id)
    pins = q.order_by(Pin.created_at).all()
    return jsonify([p.to_dict() for p in pins])


@bp.post("")
def create_pin():
    body = request.get_json(force=True) or {}
    person_id = body.get("person_id")
    application_id = body.get("application_id")
    if not person_id or not application_id:
        return jsonify({"error": "person_id and application_id are required"}), 400
    if Person.query.get(person_id) is None:
        return jsonify({"error": "person_id does not refer to a real person"}), 400
    if Application.query.get(application_id) is None:
        return jsonify({"error": "application_id does not refer to a real application"}), 400

    # Idempotent — pinning something already pinned just returns the existing row, not a
    # duplicate (the unique constraint would reject a second insert anyway).
    existing = Pin.query.filter_by(person_id=person_id, application_id=application_id).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    pin = Pin(person_id=person_id, application_id=application_id)
    db.session.add(pin)
    db.session.commit()
    return jsonify(pin.to_dict()), 201


@bp.delete("")
def delete_pin():
    """Unpin by (person_id, application_id) — query params, not a pin id, since the frontend
    always knows those two and never needs to look up the pin's own id first."""
    person_id = request.args.get("person_id")
    application_id = request.args.get("application_id")
    if not person_id or not application_id:
        return jsonify({"error": "person_id and application_id are required"}), 400

    pin = Pin.query.filter_by(person_id=person_id, application_id=application_id).first()
    if pin is None:
        return "", 204  # already not pinned — unpinning is idempotent too
    db.session.delete(pin)
    db.session.commit()
    return "", 204
