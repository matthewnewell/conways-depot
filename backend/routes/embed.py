"""
Serves the embeddable Journal widget (embed_assets/journal.js) — a plain static file, not
templated server-side; all its configuration comes from the embedding page (data-* attributes
or window.JournalWidget.configure(), see the file's own docstring). A dedicated route rather
than Flask's default static folder just to keep the URL a clean /embed/journal.js regardless of
where FRONTEND_DIST's own static handling lives.
"""

import os

from flask import Blueprint, send_from_directory

bp = Blueprint("embed", __name__, url_prefix="/embed")

_ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "embed_assets")


@bp.get("/journal.js")
def journal_widget():
    return send_from_directory(_ASSETS_DIR, "journal.js", mimetype="application/javascript")
