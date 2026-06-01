"""Tests for artworks routes not covered by test_routes.py."""
import io
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession


async def _login(async_client: AsyncClient, db_session: AsyncSession, email: str = "route_ext@test.com") -> dict:
    import sqlalchemy
    from fastapi_users.password import PasswordHelper

    from src.auth.models import User

    result = await db_session.execute(
        sqlalchemy.select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    if not user:
        helper = PasswordHelper()
        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=helper.hash("pass"),
            username=email.split("@")[0],
            role="member",
            is_active=True,
            is_superuser=False,
            is_verified=False,
        )
        db_session.add(user)
        await db_session.commit()

    resp = await async_client.post(
        "/auth/login",
        data={"username": email, "password": "pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return dict(resp.cookies)


def _jpeg_bytes(w=800, h=600, color="blue") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color=color).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
class TestArtworksRoutesExtended:

    # ── GET /api/artworks/artists ──────────────────────────────────────

    async def test_list_artists_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.get("/api/artworks/artists")
        assert resp.status_code in (401, 403)

    async def test_list_artists_returns_list(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session)
        resp = await async_client.get("/api/artworks/artists", cookies=cookies)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    # ── GET /api/artworks/artists/{slug} ──────────────────────────────

    async def test_get_artist_404(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_get404@test.com")
        resp = await async_client.get("/api/artworks/artists/does-not-exist-xyz", cookies=cookies)
        assert resp.status_code == 404

    async def test_get_artist_with_pagination(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_pag@test.com")
        csrf = cookies.get("artref_auth_csrf", "")

        # Create artist via API
        await async_client.post(
            "/api/artworks/artists",
            json={"name": "Pag Route Artist"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

        resp = await async_client.get(
            "/api/artworks/artists/pag-route-artist?limit=10&offset=0",
            cookies=cookies,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert data["limit"] == 10

    # ── GET /api/artworks/explore ──────────────────────────────────────

    async def test_explore_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.get("/api/artworks/explore")
        assert resp.status_code in (401, 403)

    async def test_explore_returns_paginated(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_explore@test.com")
        resp = await async_client.get("/api/artworks/explore?limit=10&offset=0", cookies=cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert "artworks" in data
        assert "total" in data

    async def test_explore_with_color_filter(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_explore_color@test.com")
        resp = await async_client.get("/api/artworks/explore?color=ff0000", cookies=cookies)
        assert resp.status_code == 200

    # ── DELETE /api/artworks/artworks/{id} — 404 ─────────────────────

    async def test_delete_artwork_404(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_del404@test.com")
        csrf = cookies.get("artref_auth_csrf", "")
        resp = await async_client.delete(
            f"/api/artworks/artworks/{uuid.uuid4()}",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    # ── PATCH /api/artworks/artworks/{id}/pin ─────────────────────────

    async def test_pin_artwork_404(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_pin404@test.com")
        csrf = cookies.get("artref_auth_csrf", "")
        resp = await async_client.patch(
            f"/api/artworks/artworks/{uuid.uuid4()}/pin",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_pin_artwork_success(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_pin_ok@test.com")
        csrf = cookies.get("artref_auth_csrf", "")

        # Create artist and upload artwork
        await async_client.post(
            "/api/artworks/artists",
            json={"name": "Pin Route Artist"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        upload_resp = await async_client.post(
            "/api/artworks/artists/pin-route-artist/upload",
            files=[("files", ("p.jpg", _jpeg_bytes(), "image/jpeg"))],
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert upload_resp.status_code == 200
        artwork_id = upload_resp.json()["artworks"][-1]["id"]

        pin_resp = await async_client.patch(
            f"/api/artworks/artworks/{artwork_id}/pin",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert pin_resp.status_code == 200
        assert pin_resp.json()["is_pinned"] is True

    # ── DELETE /api/artworks/artists/{slug} — 404 ────────────────────

    async def test_delete_artist_404(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_da404@test.com")
        csrf = cookies.get("artref_auth_csrf", "")
        resp = await async_client.delete(
            "/api/artworks/artists/no-such-artist-xyz",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    # ── POST /api/artworks/artists/{slug}/upload — errors ────────────

    async def test_upload_to_nonexistent_artist_404(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_up404@test.com")
        csrf = cookies.get("artref_auth_csrf", "")
        resp = await async_client.post(
            "/api/artworks/artists/nonexistent-artist/upload",
            files=[("files", ("x.jpg", _jpeg_bytes(), "image/jpeg"))],
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_upload_non_image_returns_400(self, async_client: AsyncClient, db_session: AsyncSession):
        cookies = await _login(async_client, db_session, "ext_upbad@test.com")
        csrf = cookies.get("artref_auth_csrf", "")

        await async_client.post(
            "/api/artworks/artists",
            json={"name": "Upload Bad Artist"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )

        resp = await async_client.post(
            "/api/artworks/artists/upload-bad-artist/upload",
            files=[("files", ("doc.pdf", b"%PDF-1.4 fake", "application/pdf"))],
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 400
