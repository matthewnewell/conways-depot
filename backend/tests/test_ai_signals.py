"""Unit tests for the deterministic Conway/reverse-Conway signal builders in routes/ai.py —
these are the actual analytical payoff of the registry, so they get real unit tests rather than
only curl smoke tests, same bar as Value Stream's engine.py."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.ai import _app_catalog_lines, _capability_gap_lines, _team_load_lines  # noqa: E402


class _FakeCapability:
    def __init__(self, id_, name):
        self.id = id_
        self.name = name


class _FakeApplication:
    # No `status` field — Application never got one that stuck (see db.py's
    # _drop_dead_columns comment): built/planned/external is carried by prose + the
    # presence/absence of `url`, not a flag this fake — or the real model — exposes.
    def __init__(self, name, capability_id=None, owning_team=None, capability=None,
                 description=None, category_list=None, url=None):
        self.name = name
        self.capability_id = capability_id
        self.owning_team = owning_team
        self.capability = capability
        self.description = description
        self.category_list = category_list or []
        self.url = url


def test_capability_with_built_app_is_not_flagged_as_gap():
    cap = _FakeCapability("c1", "Value Stream Mapping")
    apps = [_FakeApplication("Value Stream", capability_id="c1")]
    lines = _capability_gap_lines([cap], apps)
    assert len(lines) == 1
    assert "GAP" not in lines[0]
    assert "Value Stream" in lines[0]


def test_capability_with_registered_but_unbuilt_app_is_not_flagged_as_gap():
    # An app can be registered against a capability long before it's built (seed.py's Staffing
    # & Capacity Engine is exactly this: a real Application row, "not yet built" only in its
    # description). _capability_gap_lines' one job is "is anything registered at all" — build
    # status is a prose nuance for the AI to read, not this deterministic signal's concern.
    cap = _FakeCapability("c2", "Subcontractor SOW Management")
    apps = [_FakeApplication("SOW Tracker", capability_id="c2")]
    lines = _capability_gap_lines([cap], apps)
    assert len(lines) == 1
    assert "GAP" not in lines[0]
    assert "SOW Tracker" in lines[0]


def test_capability_with_no_registered_app_at_all_is_flagged_as_gap():
    cap = _FakeCapability("c3", "Labor Demand & Capacity Planning")
    lines = _capability_gap_lines([cap], [])
    assert "GAP" in lines[0]
    assert "nothing registered" in lines[0]


def test_team_owning_multiple_apps_is_flagged():
    apps = [
        _FakeApplication("Value Stream", owning_team="Matt"),
        _FakeApplication("BurnedValue", owning_team="Matt"),
    ]
    lines = _team_load_lines(apps)
    assert len(lines) == 1
    assert "Matt" in lines[0]
    assert "2 registered applications" in lines[0]


def test_team_owning_single_app_is_not_flagged():
    apps = [_FakeApplication("Value Stream", owning_team="Matt")]
    lines = _team_load_lines(apps)
    assert lines == ["  - No team currently owns more than one registered application."]


def test_apps_with_no_owning_team_are_ignored_in_load_signal():
    apps = [_FakeApplication("WinMax", owning_team=None)]
    lines = _team_load_lines(apps)
    assert "No team currently owns" in lines[0]


def test_app_catalog_lines_carries_description_and_built_status():
    cap = _FakeCapability("c1", "Value Stream Mapping")
    apps = [
        _FakeApplication(
            "Value Stream", capability=cap, description="Visual value-stream mapping.",
            category_list=["project"], url="http://localhost:5173",
        ),
        _FakeApplication("Unbuilt Thing", capability=None, description=None, category_list=[], url=None),
    ]
    lines = _app_catalog_lines(apps)
    assert len(lines) == 2
    # sorted alphabetically — "Unbuilt Thing" before "Value Stream"
    assert "Unbuilt Thing" in lines[0]
    assert "no url on file" in lines[0]
    assert "no description on file" in lines[0]
    assert "no capability on file" in lines[0]
    assert "Value Stream" in lines[1]
    assert "has a live url" in lines[1]
    assert "Visual value-stream mapping." in lines[1]
    assert "Value Stream Mapping" in lines[1]
    assert "project" in lines[1]
