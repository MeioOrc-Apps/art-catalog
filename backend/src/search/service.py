import logging

import httpx
from fastapi import BackgroundTasks
from slugify import slugify
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.repository import ArtworkRepository
from src.artworks.schemas import ArtistOut, SearchResponse
from src.core.database import async_session_maker
from src.storage.images import process

logger = logging.getLogger(__name__)


async def perform_search_task(
    artist_slug: str,
    artist_name: str,
    limit: int,
    provider,
):
    logger.info("Starting background search task for %s", artist_slug)
    async with async_session_maker() as session:
        repo = ArtworkRepository(session)
        artist = await repo.get_artist_by_slug(artist_slug)
        if not artist:
            return

        try:
            known_phashes = await repo.list_phashes_for_artist(artist.id)
            results = await provider.search(artist_name, limit)
            logger.info("got %d results for %s", len(results), artist_name)

            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                for r in results:
                    pi = await process(
                        r,
                        artist_slug=artist.slug,
                        known_phashes=known_phashes,
                        client=client,
                    )
                    if pi:
                        if pi.phash:
                            known_phashes.add(pi.phash)
                        await repo.persist_artworks(artist, [(r, pi)])
                        await session.commit()

            artist.sync_status = "ready"
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.exception("Error in background search for %s: %s", artist_name, e)
            artist = await repo.get_artist_by_slug(artist_slug)
            if artist:
                artist.sync_status = "error"
                await session.commit()


class SearchService:
    def __init__(self, session: AsyncSession, provider, background_tasks: BackgroundTasks):
        self._session = session
        self._provider = provider
        self._background_tasks = background_tasks
        self._repo = ArtworkRepository(session)

    async def search(
        self, artist_name: str, limit: int = 30, refresh: bool = False
    ) -> SearchResponse:
        canonical_normalized = " ".join(artist_name.strip().split())
        slug = slugify(canonical_normalized)

        if not refresh:
            cached = await self._repo.get_artist_with_artworks(slug)
            if cached is not None:
                if cached.last_searched_at is not None or cached.sync_status in ("processing", "error"):
                    return SearchResponse(
                        matched=True, artist=ArtistOut.model_validate(cached)
                    )

        artist = await self._repo.get_artist_by_slug(slug)
        if artist is None and not refresh:
            similar = await self._repo.find_similar_artists(canonical_normalized)
            if similar:
                return SearchResponse(
                    matched=False,
                    suggestion=similar[0].canonical_name,
                    suggestions=[a.canonical_name for a in similar],
                )
            
            # Spellcheck with provider
            if hasattr(self._provider, "spellcheck"):
                correction = await self._provider.spellcheck(canonical_normalized)
                if correction:
                    return SearchResponse(
                        matched=False,
                        suggestion=correction,
                        suggestions=[correction],
                    )

        if artist is None:
            artist = await self._repo.get_or_create_artist(canonical_normalized)

        if artist.sync_status != "processing" or refresh:
            artist.sync_status = "processing"
            await self._session.commit()

            self._background_tasks.add_task(
                perform_search_task,
                artist_slug=artist.slug,
                artist_name=artist_name,
                limit=limit,
                provider=self._provider,
            )

        artist_out = await self._repo.get_artist_with_artworks(artist.slug)
        return SearchResponse(
            matched=True, artist=ArtistOut.model_validate(artist_out)
        )
