import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.models import Artist, Artwork, Collection, CollectionItem


@pytest.mark.asyncio
async def test_create_collection(async_client: AsyncClient, db_session: AsyncSession):
    from tests.auth.test_admin import _create_and_login_user
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "col1@example.com")
    
    response = await async_client.post("/api/collections", json={"name": "My Collection"}, cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 201
    assert response.json()["name"] == "My Collection"

@pytest.mark.asyncio
async def test_list_collections(async_client: AsyncClient, db_session: AsyncSession):
    from tests.auth.test_admin import _create_and_login_user
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "col2@example.com")
    
    col = Collection(user_id=user.id, name="List Me")
    db_session.add(col)
    await db_session.commit()

    response = await async_client.get("/api/collections", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "List Me"

@pytest.mark.asyncio
async def test_add_item_to_collection(async_client: AsyncClient, db_session: AsyncSession):
    from tests.auth.test_admin import _create_and_login_user
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "col3@example.com")
    
    col = Collection(user_id=user.id, name="Add Item")
    db_session.add(col)
    await db_session.commit()

    artist = Artist(slug="col-artist", canonical_name="Col Artist")
    db_session.add(artist)
    await db_session.commit()
    
    aw = Artwork(artist_id=artist.id, title="ColMe", source_page_url="http://a1", source_image_url="http://i1", image_original="o1", image_large="l1", image_thumb="t1", width=10, height=10, is_downloaded=True)
    db_session.add(aw)
    await db_session.commit()

    response = await async_client.post(f"/api/collections/{col.id}/items", json={"artwork_id": str(aw.id)}, cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 201
    assert response.json()["artwork_id"] == str(aw.id)

@pytest.mark.asyncio
async def test_remove_item_from_collection(async_client: AsyncClient, db_session: AsyncSession):
    from tests.auth.test_admin import _create_and_login_user
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "col4@example.com")
    
    col = Collection(user_id=user.id, name="Remove Item")
    db_session.add(col)
    await db_session.commit()

    artist = Artist(slug="col-artist-2", canonical_name="Col Artist 2")
    db_session.add(artist)
    await db_session.commit()
    
    aw = Artwork(artist_id=artist.id, title="ColMe2", source_page_url="http://a1", source_image_url="http://i1", image_original="o1", image_large="l1", image_thumb="t1", width=10, height=10, is_downloaded=True)
    db_session.add(aw)
    await db_session.commit()

    item = CollectionItem(collection_id=col.id, artwork_id=aw.id)
    db_session.add(item)
    await db_session.commit()

    response = await async_client.delete(f"/api/collections/{col.id}/items/{aw.id}", cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 204

@pytest.mark.asyncio
async def test_delete_collection(async_client: AsyncClient, db_session: AsyncSession):
    from tests.auth.test_admin import _create_and_login_user
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "col5@example.com")
    
    col = Collection(user_id=user.id, name="Delete Me")
    db_session.add(col)
    await db_session.commit()

    response = await async_client.delete(f"/api/collections/{col.id}", cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 204
