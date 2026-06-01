"""Extended collection tests: 404, 403, duplicates, update, get by id."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.models import Artist, Artwork, Collection, CollectionItem


async def _login_user(async_client: AsyncClient, db_session: AsyncSession, email: str):
    from tests.auth.test_admin import _create_and_login_user
    return await _create_and_login_user(async_client, db_session, email)


async def _make_artwork(db_session: AsyncSession, slug_suffix: str) -> Artwork:
    artist = Artist(slug=f"col-ext-{slug_suffix}", canonical_name=f"Col Ext {slug_suffix}")
    db_session.add(artist)
    await db_session.flush()
    aw = Artwork(
        id=uuid.uuid4(),
        artist_id=artist.id,
        title=f"Artwork {slug_suffix}",
        source_page_url="http://p.example/a",
        source_image_url="http://i.example/a.jpg",
        image_original=f"o_{slug_suffix}.jpg",
        image_large=f"l_{slug_suffix}.jpg",
        image_thumb=f"t_{slug_suffix}.jpg",
        width=800,
        height=600,
        is_downloaded=True,
    )
    db_session.add(aw)
    await db_session.commit()
    return aw


@pytest.mark.asyncio
class TestCollectionsExtended:

    # ── GET /api/collections/{id} ──────────────────────────────────────

    async def test_get_collection_by_id(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "getcol@example.com")
        col = Collection(id=uuid.uuid4(), user_id=user.id, name="Get By ID")
        db_session.add(col)
        await db_session.commit()

        resp = await async_client.get(f"/api/collections/{col.id}", cookies=cookies)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Get By ID"

    async def test_get_collection_404(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "getcol404@example.com")
        resp = await async_client.get(f"/api/collections/{uuid.uuid4()}", cookies=cookies)
        assert resp.status_code == 404

    async def test_get_collection_403_other_user(self, async_client: AsyncClient, db_session: AsyncSession):
        owner, _, _ = await _login_user(async_client, db_session, "colowner@example.com")
        _, visitor_cookies, _ = await _login_user(async_client, db_session, "colvisitor@example.com")

        col = Collection(id=uuid.uuid4(), user_id=owner.id, name="Owner Only")
        db_session.add(col)
        await db_session.commit()

        resp = await async_client.get(f"/api/collections/{col.id}", cookies=visitor_cookies)
        assert resp.status_code == 403

    # ── POST /api/collections/{id}/items — duplicate ───────────────────

    async def test_add_item_duplicate_returns_409(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "coldup@example.com")
        aw = await _make_artwork(db_session, "dup")

        col = Collection(id=uuid.uuid4(), user_id=user.id, name="Dup Col")
        db_session.add(col)
        await db_session.commit()

        await async_client.post(
            f"/api/collections/{col.id}/items",
            json={"artwork_id": str(aw.id)},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        resp2 = await async_client.post(
            f"/api/collections/{col.id}/items",
            json={"artwork_id": str(aw.id)},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp2.status_code == 409

    async def test_add_item_to_nonexistent_collection_404(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        user, cookies, csrf = await _login_user(async_client, db_session, "colnoexist@example.com")
        aw = await _make_artwork(db_session, "noexist")

        resp = await async_client.post(
            f"/api/collections/{uuid.uuid4()}/items",
            json={"artwork_id": str(aw.id)},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_add_item_403_other_user(self, async_client: AsyncClient, db_session: AsyncSession):
        owner, owner_cookies, _ = await _login_user(async_client, db_session, "itowner@example.com")
        _, visitor_cookies, visitor_csrf = await _login_user(async_client, db_session, "itvisitor@example.com")
        aw = await _make_artwork(db_session, "403item")

        col = Collection(id=uuid.uuid4(), user_id=owner.id, name="Protected")
        db_session.add(col)
        await db_session.commit()

        resp = await async_client.post(
            f"/api/collections/{col.id}/items",
            json={"artwork_id": str(aw.id)},
            cookies=visitor_cookies,
            headers={"X-CSRF-Token": visitor_csrf},
        )
        assert resp.status_code == 403

    # ── PATCH /api/collections/{id}/items/{artwork_id} ─────────────────

    async def test_update_item(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "itemupdate@example.com")
        aw = await _make_artwork(db_session, "upd")

        col = Collection(id=uuid.uuid4(), user_id=user.id, name="Update Item Col")
        db_session.add(col)
        item = CollectionItem(id=uuid.uuid4(), collection_id=col.id, artwork_id=aw.id)
        db_session.add(item)
        await db_session.commit()

        resp = await async_client.patch(
            f"/api/collections/{col.id}/items/{aw.id}",
            json={"note": "great piece"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["note"] == "great piece"

    async def test_update_item_404_collection(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "updcol404@example.com")
        resp = await async_client.patch(
            f"/api/collections/{uuid.uuid4()}/items/{uuid.uuid4()}",
            json={"note": "x"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_update_item_404_item(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "upditem404@example.com")
        col = Collection(id=uuid.uuid4(), user_id=user.id, name="Item 404")
        db_session.add(col)
        await db_session.commit()

        resp = await async_client.patch(
            f"/api/collections/{col.id}/items/{uuid.uuid4()}",
            json={"note": "x"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_update_item_403(self, async_client: AsyncClient, db_session: AsyncSession):
        owner, _, _ = await _login_user(async_client, db_session, "upd403owner@example.com")
        _, visitor_cookies, visitor_csrf = await _login_user(async_client, db_session, "upd403vis@example.com")
        aw = await _make_artwork(db_session, "403upd")

        col = Collection(id=uuid.uuid4(), user_id=owner.id, name="403 Upd")
        db_session.add(col)
        item = CollectionItem(id=uuid.uuid4(), collection_id=col.id, artwork_id=aw.id)
        db_session.add(item)
        await db_session.commit()

        resp = await async_client.patch(
            f"/api/collections/{col.id}/items/{aw.id}",
            json={"note": "x"},
            cookies=visitor_cookies,
            headers={"X-CSRF-Token": visitor_csrf},
        )
        assert resp.status_code == 403

    # ── DELETE /api/collections/{id}/items/{artwork_id} ────────────────

    async def test_remove_item_404_collection(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "remcol404@example.com")
        resp = await async_client.delete(
            f"/api/collections/{uuid.uuid4()}/items/{uuid.uuid4()}",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_remove_item_404_item(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "remitem404@example.com")
        col = Collection(id=uuid.uuid4(), user_id=user.id, name="Remove 404")
        db_session.add(col)
        await db_session.commit()

        resp = await async_client.delete(
            f"/api/collections/{col.id}/items/{uuid.uuid4()}",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_remove_item_403(self, async_client: AsyncClient, db_session: AsyncSession):
        owner, _, _ = await _login_user(async_client, db_session, "rem403owner@example.com")
        _, visitor_cookies, visitor_csrf = await _login_user(async_client, db_session, "rem403vis@example.com")
        aw = await _make_artwork(db_session, "403rem")

        col = Collection(id=uuid.uuid4(), user_id=owner.id, name="403 Rem")
        db_session.add(col)
        item = CollectionItem(id=uuid.uuid4(), collection_id=col.id, artwork_id=aw.id)
        db_session.add(item)
        await db_session.commit()

        resp = await async_client.delete(
            f"/api/collections/{col.id}/items/{aw.id}",
            cookies=visitor_cookies,
            headers={"X-CSRF-Token": visitor_csrf},
        )
        assert resp.status_code == 403

    # ── DELETE /api/collections/{id} ───────────────────────────────────

    async def test_delete_collection_404(self, async_client: AsyncClient, db_session: AsyncSession):
        user, cookies, csrf = await _login_user(async_client, db_session, "delcol404@example.com")
        resp = await async_client.delete(
            f"/api/collections/{uuid.uuid4()}",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    async def test_delete_collection_403(self, async_client: AsyncClient, db_session: AsyncSession):
        owner, _, _ = await _login_user(async_client, db_session, "delcol403owner@example.com")
        _, visitor_cookies, visitor_csrf = await _login_user(async_client, db_session, "delcol403vis@example.com")

        col = Collection(id=uuid.uuid4(), user_id=owner.id, name="403 Del")
        db_session.add(col)
        await db_session.commit()

        resp = await async_client.delete(
            f"/api/collections/{col.id}",
            cookies=visitor_cookies,
            headers={"X-CSRF-Token": visitor_csrf},
        )
        assert resp.status_code == 403
