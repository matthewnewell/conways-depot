"""
Pin Presets — a quick "give me a sensible starting set of pins for my role" action on the
Launchpad. Deliberately NOT a role system: nothing here is stored on a Person, nothing gates
anything, and a preset is just a one-time action (apply it and every app it names becomes
your pinned set, replacing whatever you had) — the same "a table and one flag, not named
roles" restraint the membership-tightening work already applied. Hardcoded on purpose, per the
user's own call: five short lists beat a whole editable-presets feature for what this is.

Each preset is a COMPLETE list of app names — both organizational and project-scope — that
should be pinned once applied; nothing else stays pinned. "Default" is exactly the 7
organizational apps and nothing more, i.e. the same state a persona starts in before touching
anything — so it doubles as the Launchpad's "reset my pins" action, not a separate feature.

Referenced by app name, same pattern seed.py's own _ADMIN_PINS already uses, resolved to ids
at apply time (routes/pins.py) — never assume a fixed id, an app that isn't registered yet on
a given DB is just skipped. Mission Assurance's own list leans on this: "Lessons Learned"
isn't a built app yet (still brainstormed, see the ecosystem-new-apps memory) — it's named here
anyway and simply resolves to nothing until it exists, then starts working with no further
change needed.
"""

PRESETS: dict[str, dict] = {
    "default": {
        "label": "Default",
        "description": "The 7 organizational apps, nothing else — also your reset button.",
        "app_names": [
            "Contract & Legal Authoring",
            "Labor Supply & Demand",
            "Let's Have a Meeting",
            "Org Charts",
            "Portfolio Manager",
            "QMS",
            "Scan Me",
        ],
    },
    "functional_manager": {
        "label": "Functional Manager",
        "description": "Staffing and reporting lines across projects.",
        "app_names": [
            "Labor Supply & Demand",
            "Let's Have a Meeting",
            "Org Charts",
            "Good Plan",
        ],
    },
    "portfolio_manager": {
        "label": "Portfolio Manager",
        "description": "Cross-project oversight and performance.",
        "app_names": [
            "Let's Have a Meeting",
            "Org Charts",
            "Portfolio Manager",
            "Reckon",
        ],
    },
    "engineering_technical": {
        "label": "Engineering & Technical",
        "description": "Building and troubleshooting the work itself.",
        "app_names": [
            "Org Charts",
            "QMS",
            "Scan Me",
            "Value Stream",
            "The Fixer",
            "Scope Manager",
        ],
    },
    "supply_chain": {
        "label": "Supply Chain",
        "description": "Sourcing, procurement, and material flow.",
        "app_names": [
            "Contract & Legal Authoring",
            "QMS",
            "Scan Me",
            "MARTI",
        ],
    },
    "mission_assurance": {
        "label": "Mission Assurance",
        "description": "Quality, compliance, and closing the loop on what went wrong.",
        "app_names": [
            "Org Charts",
            "QMS",
            "Scan Me",
            "The Fixer",
            "Lessons Learned",  # not built yet — resolves to nothing until it's registered
        ],
    },
    "production_support": {
        "label": "Production Support",
        "description": "Keeping builds moving: material, routing, constraints and rework.",
        "app_names": [
            "QMS",
            "Scan Me",
            "MARTI",
            "Value Stream",
            "The Fixer",
        ],
    },
}
