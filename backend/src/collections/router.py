from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.schemas import (
    CollectionCreatePayload,
    CollectionItemAddPayload,
    CollectionItemOut,
    CollectionItemUpdatePayload,
    CollectionOut,
)
from src.auth.manager import current_active_user
from src.auth.models import User
from src.collections.repository import CollectionRepository
from src.core.database import get_async_session

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("", response_model=list[CollectionOut])
async def list_collections(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = CollectionRepository(session)
    collections = await repo.list_collections(user.id)
    return [CollectionOut.model_validate(c) for c in collections]


@router.post("", response_model=CollectionOut, status_code=201)
async def create_collection(
    payload: CollectionCreatePayload,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    from src.auth.quotas import check_collections_quota
    try:
        await check_collections_quota(session, user.id)
    except ValueError as exc:
        raise HTTPException(429, str(exc))
    repo = CollectionRepository(session)
    col = await repo.create_collection(user.id, payload.name)
    await session.commit()
    return CollectionOut.model_validate(col)


@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(
    collection_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = CollectionRepository(session)
    col = await repo.get_collection(collection_id)
    if col is None:
        raise HTTPException(404, "Coleção não encontrada")
    if col.user_id != user.id:
        raise HTTPException(403, "Acesso negado")
    return CollectionOut.model_validate(col)


@router.post("/{collection_id}/items", response_model=CollectionItemOut, status_code=201)
async def add_item(
    collection_id: UUID,
    payload: CollectionItemAddPayload,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = CollectionRepository(session)
    col = await repo.get_collection(collection_id)
    if col is None:
        raise HTTPException(404, "Coleção não encontrada")
    if col.user_id != user.id:
        raise HTTPException(403, "Acesso negado")

    item = await repo.add_item(collection_id, payload.artwork_id, payload.note)
    if item is None:
        raise HTTPException(409, "Obra já está nesta coleção")
    await session.commit()
    return CollectionItemOut.model_validate(item)


@router.patch("/{collection_id}/items/{artwork_id}", response_model=CollectionItemOut)
async def update_item(
    collection_id: UUID,
    artwork_id: UUID,
    payload: CollectionItemUpdatePayload,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = CollectionRepository(session)
    col = await repo.get_collection(collection_id)
    if col is None:
        raise HTTPException(404, "Coleção não encontrada")
    if col.user_id != user.id:
        raise HTTPException(403, "Acesso negado")

    item = await repo.update_item(collection_id, artwork_id, payload.model_dump(exclude_unset=True))
    if item is None:
        raise HTTPException(404, "Obra não está nesta coleção")
    await session.commit()
    return CollectionItemOut.model_validate(item)


@router.delete("/{collection_id}/items/{artwork_id}", status_code=204)
async def remove_item(
    collection_id: UUID,
    artwork_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = CollectionRepository(session)
    col = await repo.get_collection(collection_id)
    if col is None:
        raise HTTPException(404, "Coleção não encontrada")
    if col.user_id != user.id:
        raise HTTPException(403, "Acesso negado")

    removed = await repo.remove_item(collection_id, artwork_id)
    if not removed:
        raise HTTPException(404, "Obra não está nesta coleção")
    await session.commit()


@router.delete("/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = CollectionRepository(session)
    col = await repo.get_collection(collection_id)
    if col is None:
        raise HTTPException(404, "Coleção não encontrada")
    if col.user_id != user.id:
        raise HTTPException(403, "Acesso negado")
    await repo.delete_collection(collection_id)
