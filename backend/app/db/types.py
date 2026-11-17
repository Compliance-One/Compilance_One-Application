"""Portable column types for SQLite (CHAR(36) UUIDs, JSON)."""

from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import CHAR, TypeDecorator
from sqlalchemy.types import JSON as SA_JSON

# Re-export SQLAlchemy's dialect-agnostic JSON (stored as TEXT on SQLite).
JSON = SA_JSON


class GUID(TypeDecorator):
    """UUID stored as a hyphenated CHAR(36) string on every dialect.

    Unlike SQLAlchemy's native Uuid (CHAR(32) hex on SQLite), this always
    writes the canonical 8-4-4-4-12 form so raw SQL and ORM queries match.
    """

    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(uuid.UUID(str(value)))

    def process_result_value(self, value: Any, dialect) -> Optional[uuid.UUID]:
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        text = str(value)
        if len(text) == 32 and "-" not in text:
            return uuid.UUID(text)
        return uuid.UUID(text)
