"""Squashed SQLite baseline: all tables plus report views.

Revision ID: c8e1d4a0b2f3
Revises:
Create Date: 2026-11-17

This replaces the earlier Postgres-oriented revision chain. The schema is
created from SQLAlchemy metadata (UUID as CHAR(36), JSON instead of JSONB)
and the report views are applied in SQLite SQL. render_as_batch is enabled
in env.py for any later alters.
"""

from typing import Sequence, Union

from alembic import op

from app.db.session import Base
from app.db.views import apply_report_views, drop_report_views
import app.models.entities  # noqa: F401  — register models on Base.metadata

revision: str = "c8e1d4a0b2f3"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    apply_report_views(bind)


def downgrade() -> None:
    bind = op.get_bind()
    drop_report_views(bind)
    Base.metadata.drop_all(bind=bind)
