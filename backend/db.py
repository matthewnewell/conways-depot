"""
Database setup — SQLAlchemy over SQLite.

Mirrors Value Stream's / BurnedValue's db.py conventions: a module-level `db` object,
`init_db(app)` that creates tables then runs additive migrations, and a pragma listener
enabling foreign keys + WAL mode.
"""

import os
import uuid

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event, inspect, text

db = SQLAlchemy()


def _uuid() -> str:
    return str(uuid.uuid4())


def get_db_path(app) -> str:
    data_dir = os.environ.get("DATA_DIR", os.path.join(app.root_path, "..", "data"))
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "conwaysdepot.db")


def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


# (table_name, column_name, add_column_sql) — additive-only migrations, run after create_all().
# No Alembic: a handful of fresh tables, no legacy data.
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("application", "phase", "ALTER TABLE application ADD COLUMN phase VARCHAR(20)"),
    ("project", "portfolio_id", "ALTER TABLE project ADD COLUMN portfolio_id VARCHAR(36) REFERENCES portfolio(id)"),
    ("project", "team_notes", "ALTER TABLE project ADD COLUMN team_notes TEXT"),
    ("project", "channels", "ALTER TABLE project ADD COLUMN channels TEXT"),
    ("application", "category", "ALTER TABLE application ADD COLUMN category VARCHAR(20)"),
    ("project", "team_topology", "ALTER TABLE project ADD COLUMN team_topology VARCHAR(30)"),
    ("application", "api_url", "ALTER TABLE application ADD COLUMN api_url VARCHAR(500)"),
    (
        "project_membership", "can_manage_members",
        "ALTER TABLE project_membership ADD COLUMN can_manage_members BOOLEAN NOT NULL DEFAULT 0",
    ),
    ("project", "has_manufacturing", "ALTER TABLE project ADD COLUMN has_manufacturing BOOLEAN"),
    ("project", "contract_url", "ALTER TABLE project ADD COLUMN contract_url VARCHAR(500)"),
    ("portfolio", "channels", "ALTER TABLE portfolio ADD COLUMN channels TEXT"),
]


def _run_migrations(app):
    with app.app_context():
        inspector = inspect(db.engine)
        existing_tables = set(inspector.get_table_names())
        with db.engine.begin() as conn:
            for table_name, col_name, alter_sql in _MIGRATIONS:
                if table_name not in existing_tables:
                    continue  # table doesn't exist yet (fresh install already has the column)
                cols = {c["name"] for c in inspector.get_columns(table_name)}
                if col_name not in cols:
                    conn.execute(text(alter_sql))


# A genuinely destructive migration, unlike everything above — the one exception the module
# docstring's "no Alembic, additive-only" rule allows for. `application.status` predates the
# current model (it was replaced by prose + the presence/absence of `url`, per seed.py's own
# comment: "There's no `status` field distinguishing these"), but the column itself was never
# dropped when the model changed, and it's NOT NULL with no default — so any fresh
# `POST /api/applications` insert has been failing with an IntegrityError ever since, silently,
# because seeding only ever ran once against a schema that still had it. SQLite (3.35+) can
# drop a plain column directly, no table-rebuild dance needed.
def _drop_dead_columns(app):
    with app.app_context():
        inspector = inspect(db.engine)
        if "application" not in set(inspector.get_table_names()):
            return
        cols = {c["name"] for c in inspector.get_columns("application")}
        with db.engine.begin() as conn:
            if "status" in cols:
                conn.execute(text("ALTER TABLE application DROP COLUMN status"))
            if "phases" in cols:
                conn.execute(text("ALTER TABLE application DROP COLUMN phases"))


# The third exception to additive-only: journal_note.project_id started NOT NULL (every entry
# was project-scoped) but the personal-journal feature needs a project-less row for "plan my
# day" notes. SQLite can't ALTER a column's NOT NULL in place, so this rebuilds the table —
# same rebuild-not-alter shape as any real column-constraint change would need here, just never
# needed before now. A no-op once the live table is already nullable (fresh installs create it
# nullable straight from the model).
def _relax_journal_note_project_id(app):
    with app.app_context():
        inspector = inspect(db.engine)
        if "journal_note" not in set(inspector.get_table_names()):
            return
        cols = {c["name"]: c for c in inspector.get_columns("journal_note")}
        if "project_id" not in cols or cols["project_id"]["nullable"]:
            return
        with db.engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE journal_note_new (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    project_id VARCHAR(36) REFERENCES project(id),
                    person_id VARCHAR(36) REFERENCES person(id),
                    body TEXT NOT NULL,
                    created_at DATETIME NOT NULL
                )
            """))
            conn.execute(text(
                "INSERT INTO journal_note_new (id, project_id, person_id, body, created_at) "
                "SELECT id, project_id, person_id, body, created_at FROM journal_note"
            ))
            conn.execute(text("DROP TABLE journal_note"))
            conn.execute(text("ALTER TABLE journal_note_new RENAME TO journal_note"))
            conn.execute(text("CREATE INDEX ix_journal_note_project_id ON journal_note (project_id)"))
            conn.execute(text("CREATE INDEX ix_journal_note_person_id ON journal_note (person_id)"))


def init_db(app):
    db_path = get_db_path(app)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        event.listen(db.engine, "connect", _set_sqlite_pragma)
        db.create_all()

    _run_migrations(app)
    _drop_dead_columns(app)
    _relax_journal_note_project_id(app)
