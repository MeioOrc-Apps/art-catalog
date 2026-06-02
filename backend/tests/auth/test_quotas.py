import uuid

import pytest
import pytest_asyncio
from fastapi_users.password import PasswordHelper
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.models import Artist, Collection
from src.auth.models import User
from src.auth.quotas import (
    check_artists_quota,
    check_collections_quota,
    get_user_quota_status,
)
from src.core.config import settings


async def _make_user(db: AsyncSession, suffix: str) -> User:
    pwd = PasswordHelper()
    user = User(
        email=f"quota_{suffix}@test.com",
        username=f"quota_{suffix}",
        hashed_password=pwd.hash("testpass123"),
        is_active=True,
        is_superuser=False,
        is_verified=False,
        role="member",
    )
    db.add(user)
    await db.commit()
    return user


@pytest_asyncio.fixture(autouse=True)
async def clean_tables(db_session: AsyncSession):
    yield
    await db_session.execute(delete(Collection))
    await db_session.execute(delete(Artist))
    await db_session.execute(delete(User).where(User.email.like("quota_%@test.com")))
    await db_session.commit()


@pytest.mark.asyncio
async def test_check_artists_quota_ok(db_session: AsyncSession):
    await check_artists_quota(db_session)


@pytest.mark.asyncio
async def test_check_artists_quota_exceeded(db_session: AsyncSession, monkeypatch):
    monkeypatch.setattr(settings, "MAX_ARTISTS_TOTAL", 2)
    for i in range(2):
        db_session.add(Artist(id=uuid.uuid4(), slug=f"quota-artist-{i}", canonical_name=f"Artist {i}"))
    await db_session.commit()

    with pytest.raises(ValueError, match="Artist limit reached"):
        await check_artists_quota(db_session)


@pytest.mark.asyncio
async def test_check_collections_quota_ok(db_session: AsyncSession):
    user = await _make_user(db_session, "col_ok")
    await check_collections_quota(db_session, user.id)


@pytest.mark.asyncio
async def test_check_collections_quota_exceeded(db_session: AsyncSession, monkeypatch):
    monkeypatch.setattr(settings, "MAX_COLLECTIONS_PER_USER", 2)
    user = await _make_user(db_session, "col_exc")
    for i in range(2):
        db_session.add(Collection(id=uuid.uuid4(), user_id=user.id, name=f"Col {i}"))
    await db_session.commit()

    with pytest.raises(ValueError, match="Collection limit reached"):
        await check_collections_quota(db_session, user.id)


@pytest.mark.asyncio
async def test_get_user_quota_status(db_session: AsyncSession):
    user = await _make_user(db_session, "status")
    db_session.add(Artist(id=uuid.uuid4(), slug="quota-status-artist", canonical_name="Quota Status Artist"))
    db_session.add(Collection(id=uuid.uuid4(), user_id=user.id, name="My Col"))
    await db_session.commit()

    status = await get_user_quota_status(db_session, user.id)
    assert status["artists"]["used"] >= 1
    assert status["artists"]["limit"] == settings.MAX_ARTISTS_TOTAL
    assert status["collections"]["used"] == 1
    assert status["collections"]["limit"] == settings.MAX_COLLECTIONS_PER_USER
