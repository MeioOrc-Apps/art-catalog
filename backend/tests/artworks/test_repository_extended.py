"""Extended tests for ArtworkRepository covering methods not exercised elsewhere."""
import tempfile
import uuid
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.models import Artist
from src.artworks.repository import ArtworkRepository
from src.search.base import ImageResult
from src.storage.images import ProcessedImage


def _make_processed(
    tmp: Path, slug: str, idx: int = 0, dominant_colors: list | None = None, phash: str | None = None
) -> ProcessedImage:
    artist_dir = tmp / slug / f"aa{idx:02x}"
    artist_dir.mkdir(parents=True, exist_ok=True)
    for variant in ("original", "large", "thumb"):
        (artist_dir / f"img_{variant}.jpg").write_bytes(b"fake")
    return ProcessedImage(
        image_original=f"{slug}/aa{idx:02x}/img_original.jpg",
        image_large=f"{slug}/aa{idx:02x}/img_large.jpg",
        image_thumb=f"{slug}/aa{idx:02x}/img_thumb.jpg",
        width=1200,
        height=900,
        dominant_colors=dominant_colors if dominant_colors is not None else [[255, 0, 0]],
        phash=phash if phash is not None else f"phash_{slug}_{idx}",
    )


def _make_result(url: str = "http://img.example/a.jpg") -> ImageResult:
    return ImageResult(image_url=url, title="A Title", page_url="http://page.example/a", width=1200, height=900)


@pytest.mark.asyncio
class TestArtworkRepositoryExtended:

    # ── get_artist_by_slug ──────────────────────────────────────────────────

    async def test_get_artist_by_slug_returns_none_for_missing(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        result = await repo.get_artist_by_slug("nonexistent-slug-xyz")
        assert result is None

    async def test_get_artist_by_slug_returns_artist(self, db_session: AsyncSession):
        artist = Artist(id=uuid.uuid4(), slug="slug-fetch-test", canonical_name="Slug Fetch Test")
        db_session.add(artist)
        await db_session.commit()

        repo = ArtworkRepository(db_session)
        found = await repo.get_artist_by_slug("slug-fetch-test")
        assert found is not None
        assert found.canonical_name == "Slug Fetch Test"

    # ── get_or_create_artist ───────────────────────────────────────────────

    async def test_get_or_create_artist_creates_new(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artist = await repo.get_or_create_artist("New Artist Repo")
        await db_session.commit()

        assert artist.slug == "new-artist-repo"
        assert artist.canonical_name == "New Artist Repo"

    async def test_get_or_create_artist_returns_existing(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        a1 = await repo.get_or_create_artist("Existing Repo Artist")
        await db_session.commit()

        a2 = await repo.get_or_create_artist("Existing Repo Artist")
        assert a1.id == a2.id

    async def test_get_or_create_artist_normalises_whitespace(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artist = await repo.get_or_create_artist("  Extra   Spaces  ")
        await db_session.commit()
        # get_or_create_artist collapses all whitespace via " ".join(...split())
        assert artist.canonical_name == "Extra Spaces"

    # ── find_similar_artists ───────────────────────────────────────────────

    async def test_find_similar_artists_empty_db(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        similar = await repo.find_similar_artists("zzz no match")
        assert isinstance(similar, list)

    async def test_find_similar_artists_finds_substring_match(self, db_session: AsyncSession):
        from datetime import UTC, datetime

        repo = ArtworkRepository(db_session)
        # norm("pablo") is substring of norm("pablo picasso") → similar matches
        a = await repo.get_or_create_artist("Pablo Picasso Unique99")
        a.last_searched_at = datetime.now(UTC)
        await db_session.commit()

        # Searching for "Pablo" → norm "pablo" is inside "pablo picasso unique99"
        similar = await repo.find_similar_artists("Pablo")
        names = [s.canonical_name for s in similar]
        assert "Pablo Picasso Unique99" in names

    async def test_find_similar_artists_exact_match_excluded(self, db_session: AsyncSession):
        from datetime import UTC, datetime

        repo = ArtworkRepository(db_session)
        a = await repo.get_or_create_artist("Exact Match Artist")
        a.last_searched_at = datetime.now(UTC)
        await db_session.commit()

        similar = await repo.find_similar_artists("Exact Match Artist")
        names = [s.canonical_name for s in similar]
        assert "Exact Match Artist" not in names

    # ── persist_artworks ──────────────────────────────────────────────────

    async def test_persist_artworks_creates_records(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Persist Artist")
            await db_session.commit()

            pi = _make_processed(tmp, "persist-artist")
            result = _make_result()
            persisted = await repo.persist_artworks(artist, [(result, pi)])
            await db_session.commit()

            assert len(persisted) == 1
            assert persisted[0].phash == "phash_persist-artist_0"
            assert persisted[0].artist_id == artist.id

    async def test_persist_artworks_updates_last_searched_at(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Timestamp Artist")
            await db_session.commit()
            assert artist.last_searched_at is None

            pi = _make_processed(tmp, "timestamp-artist")
            await repo.persist_artworks(artist, [(_make_result(), pi)])
            await db_session.commit()

            assert artist.last_searched_at is not None

    # ── get_artist_with_artworks ──────────────────────────────────────────

    async def test_get_artist_with_artworks_returns_none(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        result = await repo.get_artist_with_artworks("nonexistent-with-artworks")
        assert result is None

    async def test_get_artist_with_artworks_sorts_by_pin(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Sort Pin Artist")
            await db_session.commit()

            pi1 = _make_processed(tmp, "sort-pin-artist", 0)
            pi2 = _make_processed(tmp, "sort-pin-artist", 1, phash="phash_sort_1")
            persisted = await repo.persist_artworks(
                artist, [(_make_result("http://a.com/1.jpg"), pi1),
                         (_make_result("http://a.com/2.jpg"), pi2)]
            )
            await db_session.commit()

            # pin the second one
            persisted[1].is_pinned = True
            await db_session.commit()
            db_session.expunge_all()

            fetched = await repo.get_artist_with_artworks("sort-pin-artist")
            assert fetched is not None
            assert fetched.artworks[0].is_pinned is True

    # ── get_artist_paginated ──────────────────────────────────────────────

    async def test_get_artist_paginated_returns_none_for_missing(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artist, total = await repo.get_artist_paginated("missing-paginated")
        assert artist is None
        assert total == 0

    async def test_get_artist_paginated_respects_limit_offset(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Paginate Artist")
            await db_session.commit()

            pairs = []
            for i in range(5):
                pi = _make_processed(tmp, "paginate-artist", i, phash=f"pag_phash_{i}")
                pairs.append((_make_result(f"http://a.com/{i}.jpg"), pi))
            await repo.persist_artworks(artist, pairs)
            await db_session.commit()
            db_session.expunge_all()  # clear identity map so selectinload loads fresh

            a, total = await repo.get_artist_paginated("paginate-artist", limit=2, offset=0)
            assert total == 5
            assert len(a.artworks) == 2

            db_session.expunge_all()
            a2, _ = await repo.get_artist_paginated("paginate-artist", limit=2, offset=2)
            assert len(a2.artworks) == 2

    # ── list_artists ──────────────────────────────────────────────────────

    async def test_list_artists_returns_list(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artists = await repo.list_artists()
        assert isinstance(artists, list)

    async def test_list_artists_includes_newly_created(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        await repo.get_or_create_artist("List Artists Test")
        await db_session.commit()

        artists = await repo.list_artists()
        names = [a.canonical_name for a in artists]
        assert "List Artists Test" in names

    # ── explore_artworks ─────────────────────────────────────────────────

    async def test_explore_artworks_no_filter(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artworks, total = await repo.explore_artworks(limit=10, offset=0)
        assert isinstance(artworks, list)
        assert isinstance(total, int)

    async def test_explore_artworks_with_valid_color(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Color Explore Artist")
            await db_session.commit()

            pi = _make_processed(tmp, "color-explore-artist", dominant_colors=[[255, 0, 0]])
            await repo.persist_artworks(artist, [(_make_result("http://red.example/1.jpg"), pi)])
            await db_session.commit()

            artworks, total = await repo.explore_artworks(color_hex="ff0000", limit=50)
            assert total >= 1

    async def test_explore_artworks_invalid_color_falls_back(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artworks, total = await repo.explore_artworks(color_hex="ZZZZZZ", limit=50)
        assert isinstance(artworks, list)

    async def test_explore_artworks_color_with_hash_prefix(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artworks, total = await repo.explore_artworks(color_hex="#ff0000", limit=50)
        assert isinstance(artworks, list)

    # ── list_phashes_for_artist ───────────────────────────────────────────

    async def test_list_phashes_for_artist_returns_set(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Phash Artist")
            await db_session.commit()

            pi = _make_processed(tmp, "phash-artist")
            await repo.persist_artworks(artist, [(_make_result(), pi)])
            await db_session.commit()

            phashes = await repo.list_phashes_for_artist(artist.id)
            assert isinstance(phashes, set)
            assert "phash_phash-artist_0" in phashes

    async def test_list_phashes_empty_for_new_artist(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        artist = await repo.get_or_create_artist("Empty Phash Artist")
        await db_session.commit()

        phashes = await repo.list_phashes_for_artist(artist.id)
        assert phashes == set()

    # ── delete_artwork ────────────────────────────────────────────────────

    async def test_delete_artwork_returns_false_for_missing(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        deleted = await repo.delete_artwork(uuid.uuid4(), "/tmp")
        assert deleted is False

    async def test_delete_artwork_removes_record(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Delete Artwork Artist")
            await db_session.commit()

            pi = _make_processed(tmp, "delete-artwork-artist")
            persisted = await repo.persist_artworks(artist, [(_make_result(), pi)])
            await db_session.commit()

            artwork_id = persisted[0].id
            deleted = await repo.delete_artwork(artwork_id, str(tmp))
            await db_session.commit()

            assert deleted is True
            refetched = await repo.get_artist_with_artworks("delete-artwork-artist")
            assert all(a.id != artwork_id for a in refetched.artworks)

    # ── toggle_pin_artwork ────────────────────────────────────────────────

    async def test_toggle_pin_artwork_returns_none_for_missing(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        result = await repo.toggle_pin_artwork(uuid.uuid4())
        assert result is None

    async def test_toggle_pin_artwork_flips_pin(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            artist = await repo.get_or_create_artist("Pin Toggle Artist")
            await db_session.commit()

            pi = _make_processed(tmp, "pin-toggle-artist")
            persisted = await repo.persist_artworks(artist, [(_make_result(), pi)])
            await db_session.commit()

            aw = persisted[0]
            assert aw.is_pinned is False

            toggled = await repo.toggle_pin_artwork(aw.id)
            await db_session.commit()
            assert toggled.is_pinned is True

            toggled2 = await repo.toggle_pin_artwork(aw.id)
            await db_session.commit()
            assert toggled2.is_pinned is False

    # ── delete_artist ─────────────────────────────────────────────────────

    async def test_delete_artist_returns_false_for_missing(self, db_session: AsyncSession):
        repo = ArtworkRepository(db_session)
        deleted = await repo.delete_artist("nonexistent-slug-delete", "/tmp")
        assert deleted is False

    async def test_delete_artist_removes_artist_and_dir(self, db_session: AsyncSession):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            repo = ArtworkRepository(db_session)
            await repo.get_or_create_artist("Delete Artist Full")
            await db_session.commit()

            artist_dir = tmp / "delete-artist-full"
            artist_dir.mkdir()
            (artist_dir / "img.jpg").write_bytes(b"fake")

            deleted = await repo.delete_artist("delete-artist-full", str(tmp))
            assert deleted is True
            assert not artist_dir.exists()

            found = await repo.get_artist_by_slug("delete-artist-full")
            assert found is None
