import os

# MUST be set BEFORE importing any modules that use Settings()
os.environ["ENVIRONMENT"] = "development"
os.environ["RATE_LIMITS_DISABLED"] = "true"
os.environ["IMAGES_DIR"] = "/tmp/art_test_images"

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.sql import text

import src.artworks.models  # noqa: E402, F401

# Ensure all models are loaded so create_all detects them
import src.auth.models  # noqa: E402, F401
from src.core.config import settings  # noqa: E402
from src.core.database import Base
from src.main import app

TEST_DB_NAME = "art_test"
_head, _db = settings.DATABASE_URL.rsplit("/", 1)
TEST_DATABASE_URL = f"{_head}/{TEST_DB_NAME}"

_engine = None
_sessionmaker = None


@pytest_asyncio.fixture(scope="session")
async def _setup_db():
    global _engine, _sessionmaker
    admin_url = settings.DATABASE_URL
    admin_engine = create_async_engine(admin_url, echo=False, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        result = await conn.execute(
            text(f"SELECT 1 FROM pg_database WHERE datname='{TEST_DB_NAME}'")
        )
        if not result.scalar():
            await conn.execute(text(f"CREATE DATABASE {TEST_DB_NAME}"))
    await admin_engine.dispose()

    _engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest_asyncio.fixture
async def db_session(_setup_db) -> AsyncGenerator[AsyncSession, None]:
    async with _sessionmaker() as session:
        yield session
        try:
            await session.commit()
        except Exception:
            await session.rollback()


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    async def _get_session():
        async with _sessionmaker() as session:
            yield session

    from src.core.database import get_async_session

    app.dependency_overrides[get_async_session] = _get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
