import os

from dotenv import load_dotenv

# Load backend/.env if present — same pattern Value Stream's own app.py uses. Only fills vars
# not already set in the environment, so a docker-compose / target-environment export always
# wins over a checked-out .env file. This is the one Depot instance every other app's own
# AI_PROVIDER=depot ends up calling (see ai_client.py's _depot everywhere), so its own real
# credentials matter more here than on any single sibling app.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from flask import Flask, request, send_from_directory

from db import init_db
from routes.ai import bp as ai_bp
from routes.ai_proxy import bp as ai_proxy_bp
from routes.applications import bp as applications_bp, capabilities_bp
from routes.embed import bp as embed_bp
from routes.notes import bp as notes_bp, people_notes_bp
from routes.people import bp as people_bp
from routes.pins import bp as pins_bp
from routes.projects import bp as projects_bp, external_ids_bp, links_bp, memberships_bp, portfolios_bp
from seed import seed_if_empty, seed_people_if_empty, seed_pins_if_empty

FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")


def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")

    init_db(app)

    app.register_blueprint(projects_bp)
    app.register_blueprint(external_ids_bp)
    app.register_blueprint(links_bp)
    app.register_blueprint(memberships_bp)
    app.register_blueprint(portfolios_bp)
    app.register_blueprint(applications_bp)
    app.register_blueprint(capabilities_bp)
    app.register_blueprint(people_bp)
    app.register_blueprint(pins_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(ai_proxy_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(people_notes_bp)
    app.register_blueprint(embed_bp)

    # Every other cross-app call in this ecosystem is server-to-server (see ai_proxy.py's own
    # docstring on why) — the embeddable Journal widget is the first thing that runs in a
    # sibling app's own browser tab and fetches this Depot's API directly, so it's the first
    # thing that actually needs CORS. Scoped to /api and /embed broadly rather than per-route:
    # nothing here is authenticated (see models.Person's docstring), so a wildcard origin adds
    # no real exposure beyond what already exists for any caller that knows the port.
    @app.after_request
    def _add_cors_headers(response):
        if request.path.startswith("/api/") or request.path.startswith("/embed/"):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    with app.app_context():
        seed_if_empty()
        # Separate guard from seed_if_empty: personas were added after the registry's own seed,
        # so an already-seeded dev DB still needs them backfilled on the next start.
        seed_people_if_empty()
        seed_pins_if_empty()

    @app.get("/api/health")
    def health():
        import ai_client
        return {"status": "ok", "ai_configured": ai_client.is_configured()}

    # Serve the built frontend (Vite `dist/`) in production. In dev, the Vite dev server
    # handles the UI and proxies /api/* to this Flask process instead.
    @app.get("/")
    @app.get("/<path:path>")
    def serve_frontend(path=""):
        if path and os.path.exists(os.path.join(FRONTEND_DIST, path)):
            return send_from_directory(FRONTEND_DIST, path)
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(FRONTEND_DIST, "index.html")
        return (
            "Conway's Depot backend is running, but no built frontend was found at "
            f"{FRONTEND_DIST}. Run `npm run build` in frontend/, or use `npm run dev` "
            "for local development (Vite dev server on its own port).",
            200,
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8090, debug=True)
