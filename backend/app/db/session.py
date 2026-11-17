"""Async SQLAlchemy session, defaulting to a local SQLite file."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool, StaticPool

from app.core.config import DEFAULT_DATABASE_URL, settings

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def resolve_database_url(url: str | None = None) -> str:
    """Return DATABASE_URL, resolving relative SQLite paths against the backend root."""
    raw = url or os.getenv("DATABASE_URL") or settings.DATABASE_URL or DEFAULT_DATABASE_URL
    parsed = make_url(raw)
    if parsed.get_backend_name() != "sqlite":
        return raw
    database = parsed.database
    if not database or database == ":memory:":
        return raw
    path = Path(database)
    if not path.is_absolute():
        path = (BACKEND_ROOT / path).resolve()
    return parsed.set(database=str(path)).render_as_string(hide_password=False)


def ensure_sqlite_directory(url: str) -> None:
    parsed = make_url(url)
    if parsed.get_backend_name() != "sqlite":
        return
    database = parsed.database
    if not database or database == ":memory:":
        return
    Path(database).parent.mkdir(parents=True, exist_ok=True)


def configure_sqlite_engine(engine: AsyncEngine) -> None:
    """Enable foreign keys and WAL on every SQLite connection."""
    if engine.url.get_backend_name() != "sqlite":
        return

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def create_engine(url: str | None = None) -> AsyncEngine:
    resolved = resolve_database_url(url)
    ensure_sqlite_directory(resolved)
    parsed = make_url(resolved)
    kwargs: dict = {"echo": False, "future": True}
    if parsed.get_backend_name() == "sqlite":
        kwargs["connect_args"] = {"check_same_thread": False}
        # :memory: needs a single shared connection; a file DB uses NullPool
        # so each checkout is a fresh connection with PRAGMAs applied.
        if not parsed.database or parsed.database == ":memory:":
            kwargs["poolclass"] = StaticPool
        else:
            kwargs["poolclass"] = NullPool
    engine = create_async_engine(resolved, **kwargs)
    configure_sqlite_engine(engine)
    return engine


DATABASE_URL = resolve_database_url()
engine = create_engine(DATABASE_URL)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


# Alias for FastAPI dependency injection
get_db = get_db_session
