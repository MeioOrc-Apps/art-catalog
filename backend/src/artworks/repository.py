import logging
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.artworks.models import Artist, Artwork
from src.artworks.schemas import normalize_name
from src.search.base import ImageResult
from src.storage.images import ProcessedImage

logger = logging.getLogger(__name__)


class ArtworkRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_artist_by_slug(self, slug: str) -> Artist | None:
        result = await self._session.execute(
            select(Artist).options(selectinload(Artist.artworks)).where(Artist.slug == slug)
        )
        return result.scalar_one_or_none()

    async def get_or_create_artist(self, canonical_name: str) -> Artist:
        canonical_normalized = " ".join(canonical_name.strip().split())
        slug = slugify(canonical_normalized)
        artist = await self.get_artist_by_slug(slug)
        if artist is not None:
            return artist

        artist = Artist(
            id=uuid.uuid4(),
            slug=slug,
            canonical_name=canonical_normalized,
        )
        self._session.add(artist)
        await self._session.flush()
        # Refresh to eager load relationships (artworks)
        await self._session.refresh(artist, ["artworks"])
        return artist

    async def find_similar_artists(self, term: str) -> list[Artist]:
        norm = normalize_name(term)
        result = await self._session.execute(
            select(Artist)
            .options(selectinload(Artist.artworks))
            .order_by(Artist.last_searched_at.desc())
        )
        all_artists = list(result.unique().scalars().all())
        for a in all_artists:
            a.artworks = sorted(a.artworks, key=lambda w: (w.is_pinned, w.created_at), reverse=True)

        similar = []
        for a in all_artists:
            a_norm = normalize_name(a.canonical_name)
            if a_norm == norm:
                continue
            if a.last_searched_at is None:
                continue
            if a_norm in norm and len(a_norm) < len(norm):
                continue
            if norm in a_norm or a_norm in norm:
                similar.append(a)

        return similar

    async def persist_artworks(
        self,
        artist: Artist,
        processed: list[tuple[ImageResult, ProcessedImage]],
    ) -> list[Artwork]:
        persisted = []
        for result, pi in processed:
            artwork = Artwork(
                id=uuid.uuid4(),
                artist_id=artist.id,
                source_image_url=result.image_url,
                title=result.title,
                source_page_url=result.page_url,
                image_original=pi.image_original,
                image_large=pi.image_large,
                image_thumb=pi.image_thumb,
                width=pi.width,
                height=pi.height,
                dominant_colors=pi.dominant_colors,
                phash=pi.phash,
                is_downloaded=True,
            )
            self._session.add(artwork)
            persisted.append(artwork)

        artist.last_searched_at = datetime.now(UTC)
        await self._session.flush()
        return persisted

    async def get_artist_with_artworks(self, slug: str) -> Artist | None:
        result = await self._session.execute(
            select(Artist)
            .options(selectinload(Artist.artworks))
            .where(Artist.slug == slug)
        )
        artist = result.unique().scalar_one_or_none()
        if artist:
            artist.artworks = sorted(artist.artworks, key=lambda w: (w.is_pinned, w.created_at), reverse=True)
        return artist

    async def get_artist_paginated(
        self, slug: str, limit: int = 30, offset: int = 0
    ) -> tuple[Artist | None, int]:
        result = await self._session.execute(
            select(Artist)
            .options(selectinload(Artist.artworks))
            .where(Artist.slug == slug)
        )
        artist = result.unique().scalar_one_or_none()
        if artist is None:
            return None, 0

        all_artworks = sorted(artist.artworks, key=lambda w: (w.is_pinned, w.created_at), reverse=True)
        total = len(all_artworks)
        artist.artworks = all_artworks[offset : offset + limit]
        return artist, total

    async def list_artists(self) -> list[Artist]:
        result = await self._session.execute(
            select(Artist)
            .options(selectinload(Artist.artworks))
            .order_by(Artist.last_searched_at.desc())
        )
        artists = list(result.unique().scalars().all())
        for a in artists:
            a.artworks = sorted(a.artworks, key=lambda w: (w.is_pinned, w.created_at), reverse=True)
        return artists

    async def explore_artworks(self, color_hex: str | None = None, limit: int = 50, offset: int = 0) -> tuple[list[Artwork], int]:
        stmt = select(Artwork).options(selectinload(Artwork.artist)).order_by(Artwork.created_at.desc())
        result = await self._session.execute(stmt)
        all_artworks = list(result.scalars().all())

        if not color_hex:
            return all_artworks[offset:offset+limit], len(all_artworks)

        color_hex = color_hex.lstrip('#')
        try:
            tr, tg, tb = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
        except ValueError:
            return all_artworks[offset:offset+limit], len(all_artworks)

        def color_distance(c1, c2):
            return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) ** 0.5

        def min_distance(artwork):
            if not artwork.dominant_colors:
                return float('inf')
            return min(color_distance((tr, tg, tb), c) for c in artwork.dominant_colors)

        THRESHOLD = 100
        matched = []
        for aw in all_artworks:
            d = min_distance(aw)
            if d < THRESHOLD:
                matched.append((d, aw))

        matched.sort(key=lambda x: x[0])
        sorted_artworks = [m[1] for m in matched]
        return sorted_artworks[offset:offset+limit], len(sorted_artworks)

    async def list_phashes_for_artist(self, artist_id: uuid.UUID) -> set[str]:
        result = await self._session.execute(
            select(Artwork.phash).where(Artwork.artist_id == artist_id)
        )
        return {row[0] for row in result if row[0] is not None}

    async def delete_artwork(self, artwork_id: uuid.UUID, images_dir: str) -> bool:
        result = await self._session.execute(
            select(Artwork).where(Artwork.id == artwork_id)
        )
        artwork = result.scalar_one_or_none()
        if artwork is None:
            return False

        if artwork.image_original:
            try:
                # image_original is like "artist_slug/hash/file.jpg"
                # we want to delete the hash folder
                file_path = Path(images_dir) / artwork.image_original
                hash_dir = file_path.parent
                if hash_dir.exists() and hash_dir.name != artwork.artist_id: # basic safety check
                    shutil.rmtree(hash_dir)
            except OSError as e:
                logger.warning("failed to delete image dir for artwork %s: %s", artwork_id, e)

        await self._session.delete(artwork)
        return True

    async def toggle_pin_artwork(self, artwork_id: uuid.UUID) -> Artwork | None:
        result = await self._session.execute(
            select(Artwork)
            .options(selectinload(Artwork.artist))
            .where(Artwork.id == artwork_id)
        )
        artwork = result.scalar_one_or_none()
        if artwork is None:
            return None
            
        artwork.is_pinned = not artwork.is_pinned
        await self._session.flush()
        return artwork

    async def delete_artist(self, slug: str, images_dir: str) -> bool:
        result = await self._session.execute(
            select(Artist).where(Artist.slug == slug)
        )
        artist = result.scalar_one_or_none()
        if artist is None:
            return False

        artist_dir = Path(images_dir) / slug
        if artist_dir.exists():
            try:
                shutil.rmtree(artist_dir)
            except OSError as e:
                logger.warning("failed to delete image dir %s: %s", artist_dir, e)

        await self._session.delete(artist)
        await self._session.commit()
        return True
