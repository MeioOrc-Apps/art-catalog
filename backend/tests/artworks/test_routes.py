import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _login(async_client: AsyncClient, db_session: AsyncSession) -> dict:
    from fastapi_users.password import PasswordHelper

    from src.auth.models import User

    result = await db_session.execute(
        __import__("sqlalchemy").select(User).where(User.email == "test@search.com")
    )
    user = result.scalar_one_or_none()
    if not user:
        helper = PasswordHelper()
        user = User(
            id=uuid.uuid4(),
            email="test@search.com",
            hashed_password=helper.hash("testpass"),
            username="searchuser",
            role="member",
            is_active=True,
            is_superuser=False,
            is_verified=False,
        )
        db_session.add(user)
        await db_session.commit()

    resp = await async_client.post(
        "/auth/login",
        data={"username": "test@search.com", "password": "testpass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return dict(resp.cookies)


@pytest.mark.asyncio
class TestSearchRoute:
    async def test_search_requires_auth(self, async_client: AsyncClient):
        response = await async_client.post(
            "/api/artworks/search",
            json={"artist": "Egon Schiele"},
        )
        assert response.status_code in (401, 403)

    async def test_search_with_mock_provider(
        self, async_client: AsyncClient, db_session: AsyncSession, monkeypatch,
    ):
        import tempfile
        from pathlib import Path

        import src.core.config as cfg
        tmp = Path(tempfile.mkdtemp())
        monkeypatch.setattr(cfg.settings, "images_dir", str(tmp))

        try:
            cookies = await _login(async_client, db_session)
            csrf = cookies.get("artref_auth_csrf", "")

            response = await async_client.post(
                "/api/artworks/search",
                json={"artist": "Egon Schiele", "limit": 3},
                cookies=cookies,
                headers={"X-CSRF-Token": csrf},
            )
            assert response.status_code == 200
            data = response.json()
            artist = data["artist"]
            assert artist["slug"] == "egon-schiele"
            assert artist["canonical_name"] == "Egon Schiele"
            assert artist["sync_status"] == "processing"
            assert len(artist["artworks"]) == 0
        finally:
            import shutil

            shutil.rmtree(tmp, ignore_errors=True)

    async def test_search_cache_hit(
        self, async_client: AsyncClient, db_session: AsyncSession, monkeypatch,
    ):
        import tempfile
        from pathlib import Path

        import src.core.config as cfg
        tmp = Path(tempfile.mkdtemp())
        monkeypatch.setattr(cfg.settings, "images_dir", str(tmp))

        try:
            cookies = await _login(async_client, db_session)
            csrf = cookies.get("artref_auth_csrf", "")

            # First call
            r1 = await async_client.post(
                "/api/artworks/search",
                json={"artist": "Cache Test", "limit": 2},
                cookies=cookies,
                headers={"X-CSRF-Token": csrf},
            )
            assert r1.status_code == 200

            # Second call should be cache hit (same data)
            r2 = await async_client.post(
                "/api/artworks/search",
                json={"artist": "Cache Test", "limit": 2},
                cookies=cookies,
                headers={"X-CSRF-Token": csrf},
            )
            assert r2.status_code == 200
            assert len(r2.json()["artist"]["artworks"]) > 0
        finally:
            import shutil

            shutil.rmtree(tmp, ignore_errors=True)

    async def test_search_requires_csrf(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ):
        cookies = await _login(async_client, db_session)
        response = await async_client.post(
            "/api/artworks/search",
            json={"artist": "X"},
            cookies=cookies,
        )
        assert response.status_code == 403

    async def test_create_artist_manual(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ):
        cookies = await _login(async_client, db_session)
        csrf = cookies.get("artref_auth_csrf") or ""
        response = await async_client.post(
            "/api/artworks/artists",
            json={"name": "Custom Artist"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["canonical_name"] == "Custom Artist"
        assert data["slug"] == "custom-artist"
        assert data["sync_status"] == "ready"

    async def test_upload_artwork_manual(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ):
        cookies = await _login(async_client, db_session)
        csrf = cookies.get("artref_auth_csrf") or ""
        
        # First create an artist
        await async_client.post(
            "/api/artworks/artists",
            json={"name": "Upload Target"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

        import io

        from PIL import Image
        img = Image.new("RGB", (800, 600), color="red")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        file_bytes = buf.getvalue()

        response = await async_client.post(
            "/api/artworks/artists/upload-target/upload",
            files=[("files", ("test.jpg", file_bytes, "image/jpeg"))],
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["artworks"]) >= 1
        assert data["artworks"][-1]["title"] == "test.jpg"
        assert data["artworks"][-1]["source_image_url"].startswith("manual_upload")

    async def test_delete_artwork(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ):
        cookies = await _login(async_client, db_session)
        csrf = cookies.get("artref_auth_csrf") or ""
        
        # First create an artist
        await async_client.post(
            "/api/artworks/artists",
            json={"name": "Delete Target"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

        import io

        from PIL import Image
        img = Image.new("RGB", (800, 600), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        
        upload_resp = await async_client.post(
            "/api/artworks/artists/delete-target/upload",
            files=[("files", ("delete_me.jpg", buf.getvalue(), "image/jpeg"))],
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert upload_resp.status_code == 200
        
        artwork_id = upload_resp.json()["artworks"][-1]["id"]

        # Now delete it
        del_resp = await async_client.delete(
            f"/api/artworks/artworks/{artwork_id}",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert del_resp.status_code == 204

        # Verify it's gone
        get_resp = await async_client.get(
            "/api/artworks/artists/delete-target",
            cookies=cookies,
        )
        assert len(get_resp.json()["artworks"]) == 0
