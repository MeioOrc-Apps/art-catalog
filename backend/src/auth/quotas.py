import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.models import Artist, Collection
from src.core.config import settings


async def check_artists_quota(db: AsyncSession) -> None:
    """Raise ValueError if total artist count has reached the system cap."""
    count = (
        await db.execute(select(func.count(Artist.id)))
    ).scalar_one()
    if count >= settings.MAX_ARTISTS_TOTAL:
        raise ValueError(
            f"Artist limit reached ({count}/{settings.MAX_ARTISTS_TOTAL}). "
            "Delete some artists before adding new ones."
        )


async def check_collections_quota(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Raise ValueError if the user has reached their collection limit."""
    count = (
        await db.execute(
            select(func.count(Collection.id)).where(Collection.user_id == user_id)
        )
    ).scalar_one()
    if count >= settings.MAX_COLLECTIONS_PER_USER:
        raise ValueError(
            f"Collection limit reached ({count}/{settings.MAX_COLLECTIONS_PER_USER}). "
            "Delete some collections before creating new ones."
        )


async def get_user_quota_status(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """Return current quota usage for the user."""
    artists_count = (
        await db.execute(select(func.count(Artist.id)))
    ).scalar_one()

    collections_count = (
        await db.execute(
            select(func.count(Collection.id)).where(Collection.user_id == user_id)
        )
    ).scalar_one()

    return {
        "artists": {
            "used": artists_count,
            "limit": settings.MAX_ARTISTS_TOTAL,
        },
        "collections": {
            "used": collections_count,
            "limit": settings.MAX_COLLECTIONS_PER_USER,
        },
    }
