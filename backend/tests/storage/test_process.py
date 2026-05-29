import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import AsyncClient

from src.search.base import ImageResult


@pytest.mark.asyncio
class TestProcessMock:
    async def test_process_mock_url(self, monkeypatch):
        from src.storage.images import process

        tmp_dir = Path(tempfile.mkdtemp())

        import src.core.config as cfg
        monkeypatch.setattr(cfg.settings, "images_dir", str(tmp_dir))

        try:
            result = ImageResult(
                image_url="mock://abc/0.jpg",
                title="Test",
                page_url=None,
                width=1200,
                height=900,
            )
            known: set[str] = set()
            async with AsyncClient() as client:
                processed = await process(
                    result, artist_slug="egon-schiele",
                    known_phashes=known, client=client,
                )
            assert processed is not None
            assert processed.image_original.startswith("egon-schiele/")
            assert processed.image_thumb.startswith("egon-schiele/")
            assert processed.image_large.startswith("egon-schiele/")
            assert len(processed.dominant_colors) == 5
            assert processed.phash is not None
            assert processed.phash in known
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)


@pytest.mark.asyncio
class TestProcessDedup:
    async def test_dedup_returns_none_on_same_phash(self, monkeypatch):
        from src.storage.images import process

        tmp_dir = Path(tempfile.mkdtemp())

        import src.core.config as cfg
        monkeypatch.setattr(cfg.settings, "images_dir", str(tmp_dir))

        try:
            result = ImageResult(
                image_url="mock://abc/0.jpg",
                title="Test",
                page_url=None,
                width=1200,
                height=900,
            )
            known: set[str] = set()
            async with AsyncClient() as client:
                p1 = await process(
                    result, artist_slug="x", known_phashes=known,
                    client=client,
                )
                assert p1 is not None
                p2 = await process(
                    result, artist_slug="x", known_phashes=known,
                    client=client,
                )
                assert p2 is None
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
