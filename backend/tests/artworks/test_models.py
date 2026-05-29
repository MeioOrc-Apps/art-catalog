import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestArtistModel:
    async def test_artist_persists_with_required_fields(self, db_session: AsyncSession):
        from src.artworks.models import Artist

        artist = Artist(
            id=uuid.uuid4(),
            slug="model-test-artist",
            canonical_name="Model Test Artist",
        )
        db_session.add(artist)
        await db_session.commit()

        result = await db_session.execute(
            select(Artist).where(Artist.slug == "model-test-artist")
        )
        loaded = result.scalar_one()
        assert loaded.canonical_name == "Model Test Artist"
        assert loaded.created_at is not None

    async def test_artist_slug_is_unique(self, db_session: AsyncSession):
        from src.artworks.models import Artist

        a1 = Artist(id=uuid.uuid4(), slug="dupe", canonical_name="Test")
        a2 = Artist(id=uuid.uuid4(), slug="dupe", canonical_name="Test 2")
        db_session.add(a1)
        db_session.add(a2)
        with pytest.raises(IntegrityError):
            await db_session.commit()


@pytest.mark.asyncio
class TestArtworkModel:
    async def test_artwork_persists_with_jsonb_colors(self, db_session: AsyncSession):
        from src.artworks.models import Artist, Artwork

        artist = Artist(id=uuid.uuid4(), slug="test-artist", canonical_name="Test Artist")
        db_session.add(artist)
        await db_session.flush()

        artwork = Artwork(
            id=uuid.uuid4(),
            artist_id=artist.id,
            source_image_url="http://example.com/img.jpg",
            phash="abc123",
            dominant_colors=[[255, 0, 0], [0, 255, 0]],
            width=1200,
            height=900,
        )
        db_session.add(artwork)
        await db_session.commit()

        result = await db_session.execute(
            select(Artwork).where(Artwork.id == artwork.id)
        )
        loaded = result.scalar_one()
        assert loaded.dominant_colors == [[255, 0, 0], [0, 255, 0]]
        assert loaded.width == 1200

    async def test_unique_artist_id_phash(self, db_session: AsyncSession):
        from src.artworks.models import Artist, Artwork

        artist = Artist(id=uuid.uuid4(), slug="phash-test", canonical_name="Phash Test")
        db_session.add(artist)
        await db_session.flush()

        a1 = Artwork(
            id=uuid.uuid4(),
            artist_id=artist.id,
            source_image_url="http://x.com/1.jpg",
            phash="samehash",
        )
        a2 = Artwork(
            id=uuid.uuid4(),
            artist_id=artist.id,
            source_image_url="http://x.com/2.jpg",
            phash="samehash",
        )
        db_session.add_all([a1, a2])
        with pytest.raises(IntegrityError):
            await db_session.commit()
