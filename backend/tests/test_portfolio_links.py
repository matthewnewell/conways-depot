"""Portfolio-level jumpstation links: stored on the portfolio, surfaced on every member project as
`portfolio_links` (so a project never has to copy them)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from flask import Flask

from db import db
from routes.projects import bp as projects_bp, portfolios_bp


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["TESTING"] = True
    db.init_app(app)
    app.register_blueprint(projects_bp)
    app.register_blueprint(portfolios_bp)
    with app.app_context():
        db.create_all()
    with app.test_client() as c:
        yield c


LINKS = [{"label": "Programs SharePoint", "url": "https://contoso.sharepoint.com/sites/p", "kind": "sharepoint"}]


def test_portfolio_links_round_trip(client):
    pf = client.post("/api/portfolios", json={"name": "Industrial"}).get_json()
    assert pf["channels"] == []
    res = client.put(f"/api/portfolios/{pf['id']}", json={"channels": LINKS})
    assert res.status_code == 200
    assert res.get_json()["channels"] == LINKS
    assert client.get("/api/portfolios").get_json()[0]["channels"] == LINKS


def test_member_project_exposes_portfolio_links(client):
    pf = client.post("/api/portfolios", json={"name": "Industrial", "channels": LINKS}).get_json()
    proj = client.post("/api/projects", json={"name": "P", "portfolio_id": pf["id"]}).get_json()
    got = client.get(f"/api/projects/{proj['id']}").get_json()
    assert got["portfolio_links"] == LINKS
    assert got["channels"] == []  # the project's own list is untouched


def test_project_without_portfolio_has_no_portfolio_links(client):
    proj = client.post("/api/projects", json={"name": "Solo"}).get_json()
    assert client.get(f"/api/projects/{proj['id']}").get_json()["portfolio_links"] == []


def test_update_portfolio_rejects_empty_name(client):
    pf = client.post("/api/portfolios", json={"name": "Industrial"}).get_json()
    assert client.put(f"/api/portfolios/{pf['id']}", json={"name": "  "}).status_code == 400
