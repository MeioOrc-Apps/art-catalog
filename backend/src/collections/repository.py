import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.artworks.models import Artwork, Collection, CollectionItem


class CollectionRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_collections(self, user_id: uuid.UUID) -> list[Collection]:
        result = await self._session.execute(
            select(Collection)
            .options(
                selectinload(Collection.items)
                .selectinload(CollectionItem.artwork)
                .selectinload(Artwork.artist)
            )
            .where(Collection.user_id == user_id)
            .order_by(Collection.created_at.desc())
        )
        return list(result.unique().scalars().all())

    async def get_collection(self, collection_id: uuid.UUID) -> Collection | None:
        result = await self._session.execute(
            select(Collection)
            .options(
                selectinload(Collection.items)
                .selectinload(CollectionItem.artwork)
                .selectinload(Artwork.artist)
            )
            .where(Collection.id == collection_id)
        )
        return result.unique().scalar_one_or_none()

    async def create_collection(self, user_id: uuid.UUID, name: str) -> Collection:
        col = Collection(id=uuid.uuid4(), user_id=user_id, name=name)
        self._session.add(col)
        await self._session.flush()

        result = await self._session.execute(
            select(Collection)
            .options(
                selectinload(Collection.items)
                .selectinload(CollectionItem.artwork)
                .selectinload(Artwork.artist)
            )
            .where(Collection.id == col.id)
        )
        return result.unique().scalar_one()

    async def add_item(
        self, collection_id: uuid.UUID, artwork_id: uuid.UUID, note: str | None = None
    ) -> CollectionItem | None:
        col = await self.get_collection(collection_id)
        if col is None:
            return None

        existing = await self._session.execute(
            select(CollectionItem).where(
                CollectionItem.collection_id == collection_id,
                CollectionItem.artwork_id == artwork_id,
            )
        )
        if existing.scalar_one_or_none():
            return None

        item = CollectionItem(
            id=uuid.uuid4(),
            collection_id=collection_id,
            artwork_id=artwork_id,
            note=note,
        )
        self._session.add(item)
        await self._session.flush()

        result = await self._session.execute(
            select(CollectionItem)
            .options(selectinload(CollectionItem.artwork).selectinload(Artwork.artist))
            .where(CollectionItem.id == item.id)
        )
        return result.scalar_one()

    async def update_item(
        self, collection_id: uuid.UUID, artwork_id: uuid.UUID, payload: dict
    ) -> CollectionItem | None:
        result = await self._session.execute(
            select(CollectionItem).where(
                CollectionItem.collection_id == collection_id,
                CollectionItem.artwork_id == artwork_id,
            )
        )
        item = result.scalar_one_or_none()
        if item is None:
            return None

        for key, value in payload.items():
            if value is not None:
                setattr(item, key, value)

        await self._session.flush()

        result = await self._session.execute(
            select(CollectionItem)
            .options(selectinload(CollectionItem.artwork).selectinload(Artwork.artist))
            .where(CollectionItem.id == item.id)
        )
        return result.scalar_one()

    async def remove_item(self, collection_id: uuid.UUID, artwork_id: uuid.UUID) -> bool:
        result = await self._session.execute(
            select(CollectionItem).where(
                CollectionItem.collection_id == collection_id,
                CollectionItem.artwork_id == artwork_id,
            )
        )
        item = result.scalar_one_or_none()
        if item is None:
            return False
        await self._session.delete(item)
        await self._session.flush()
        return True

    async def delete_collection(self, collection_id: uuid.UUID) -> bool:
        col = await self.get_collection(collection_id)
        if col is None:
            return False
        await self._session.delete(col)
        await self._session.commit()
        return True
