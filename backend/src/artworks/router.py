from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.repository import ArtworkRepository
from src.artworks.schemas import (
    ArtistCreatePayload,
    ArtistOut,
    ArtistOutPaginated,
    ArtworkOut,
    ExploreOutPaginated,
    SearchPayload,
    SearchResponse,
)
from src.auth.manager import current_active_user
from src.auth.models import User
from src.core.config import settings
from src.core.database import get_async_session
from src.search import get_provider
from src.search.base import ImageResult
from src.search.service import SearchService
from src.storage.images import process_raw_image

router = APIRouter(prefix="/api/artworks", tags=["artworks"])


@router.post("/search", response_model=SearchResponse)
async def search_artworks(
    payload: SearchPayload,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    provider = get_provider()
    service = SearchService(session, provider, background_tasks)
    return await service.search(
        artist_name=payload.artist,
        limit=payload.limit,
        refresh=payload.refresh,
    )


@router.get("/artists", response_model=list[ArtistOut])
async def list_artists(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    artists = await repo.list_artists()
    return [ArtistOut.model_validate(a) for a in artists]

@router.get("/explore", response_model=ExploreOutPaginated)
async def explore_artworks(
    color: str | None = Query(default=None, description="Hex color code (e.g. ff0000)"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    artworks, total = await repo.explore_artworks(color_hex=color, limit=limit, offset=offset)
    return ExploreOutPaginated(
        artworks=[ArtworkOut.model_validate(a) for a in artworks],
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/artists/{slug}", response_model=ArtistOutPaginated)
async def get_artist(
    slug: str,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    artist, total = await repo.get_artist_paginated(slug, limit=limit, offset=offset)
    if artist is None:
        raise HTTPException(404, "Artista não encontrado")
    out = ArtistOutPaginated.model_validate(artist)
    out.total = total
    out.limit = limit
    out.offset = offset
    return out


@router.post("/artists", response_model=ArtistOut)
async def create_artist(
    payload: ArtistCreatePayload,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    artist = await repo.get_or_create_artist(payload.name)
    await session.commit()
    return artist

@router.delete("/artworks/{artwork_id}", status_code=204)
async def delete_artwork(
    artwork_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    deleted = await repo.delete_artwork(artwork_id, settings.images_dir)
    if not deleted:
        raise HTTPException(404, "Obra não encontrada")
    await session.commit()

@router.patch("/artworks/{artwork_id}/pin", response_model=ArtworkOut)
async def toggle_pin_artwork(
    artwork_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    artwork = await repo.toggle_pin_artwork(artwork_id)
    if not artwork:
        raise HTTPException(404, "Obra não encontrada")
    await session.commit()
    return artwork

@router.delete("/artists/{slug}", status_code=204)
async def delete_artist(
    slug: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    deleted = await repo.delete_artist(slug, settings.images_dir)
    if not deleted:
        raise HTTPException(404, "Artista não encontrado")
    await session.commit()


@router.post("/artists/{slug}/upload", response_model=ArtistOut)
async def upload_artwork(
    slug: str,
    files: list[UploadFile] = File(...),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    repo = ArtworkRepository(session)
    artist = await repo.get_artist_by_slug(slug)
    if not artist:
        raise HTTPException(404, "Artista não encontrado")

    known_phashes = {a.phash for a in artist.artworks if a.phash}
    artworks_to_persist = []

    import uuid

    for file in files:
        if not file.content_type.startswith("image/"):
            continue
            
        data = await file.read()
        if len(data) > settings.max_download_mb * 1024 * 1024:
            continue

        unique_source = f"manual_upload_{uuid.uuid4()}"
        pi = await process_raw_image(
            data,
            artist_slug=artist.slug,
            known_phashes=known_phashes,
            source_url=unique_source
        )

        if pi:
            mock_result = ImageResult(
                image_url=unique_source,
                title=file.filename or "Manual Upload",
                page_url=unique_source,
                width=pi.width,
                height=pi.height,
            )
            artworks_to_persist.append((mock_result, pi))
            if pi.phash:
                known_phashes.add(pi.phash)

    if not artworks_to_persist:
        raise HTTPException(400, "Nenhuma imagem válida pôde ser processada (formatos inválidos, imagens muito pequenas ou duplicadas).")

    await repo.persist_artworks(artist, artworks_to_persist)
    await session.commit()
    # Refresh to eager load relationships (artworks)
    await session.refresh(artist, ["artworks"])

    # Re-fetch to get updated artworks list
    artist = await repo.get_artist_by_slug(slug)
    return artist
