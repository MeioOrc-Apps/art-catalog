
import pytest
from fastapi_users.password import PasswordHelper
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.artworks.models import Artist, Artwork
from src.auth.models import User


async def _create_and_login_user(async_client: AsyncClient, db_session: AsyncSession, email: str, role: str = "member"):
    pwd_helper = PasswordHelper()
    user = User(
        email=email,
        username=email,
        hashed_password=pwd_helper.hash("testpass123"),
        is_active=True,
        is_superuser=False,
        is_verified=False,
        role=role,
    )
    db_session.add(user)
    await db_session.commit()
    resp = await async_client.post(
        "/auth/login",
        data={"username": email, "password": "testpass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    cookies = resp.cookies
    csrf = cookies.get("artref_auth_csrf", "")
    return user, cookies, csrf

@pytest.mark.asyncio
async def test_explore_artworks_no_color(async_client: AsyncClient, db_session: AsyncSession):
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "explore1@example.com")
    
    # Setup some artworks
    artist = Artist(slug="test-artist-explore-1", canonical_name="Test Artist")
    db_session.add(artist)
    await db_session.commit()
    
    aw1 = Artwork(artist_id=artist.id, title="A1", source_page_url="http://a1", source_image_url="http://i1", image_original="o1", image_large="l1", image_thumb="t1", width=10, height=10, is_downloaded=True)
    aw2 = Artwork(artist_id=artist.id, title="A2", source_page_url="http://a2", source_image_url="http://i2", image_original="o2", image_large="l2", image_thumb="t2", width=10, height=10, is_downloaded=True)
    db_session.add_all([aw1, aw2])
    await db_session.commit()

    response = await async_client.get("/api/artworks/explore", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    assert len(data["artworks"]) >= 2

@pytest.mark.asyncio
async def test_explore_artworks_with_color(async_client: AsyncClient, db_session: AsyncSession):
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "explore2@example.com")
    
    artist = Artist(slug="color-artist", canonical_name="Color Artist")
    db_session.add(artist)
    await db_session.commit()
    
    aw1 = Artwork(artist_id=artist.id, title="Red", source_page_url="http://a1", source_image_url="http://i1", image_original="o1", image_large="l1", image_thumb="t1", width=10, height=10, is_downloaded=True, dominant_colors=[(255, 0, 0)])
    aw2 = Artwork(artist_id=artist.id, title="Blue", source_page_url="http://a2", source_image_url="http://i2", image_original="o2", image_large="l2", image_thumb="t2", width=10, height=10, is_downloaded=True, dominant_colors=[(0, 0, 255)])
    db_session.add_all([aw1, aw2])
    await db_session.commit()

    response = await async_client.get("/api/artworks/explore?color=ff0000", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert data["artworks"][0]["title"] == "Red"

@pytest.mark.asyncio
async def test_toggle_pin_artwork(async_client: AsyncClient, db_session: AsyncSession):
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "pin@example.com")
    
    artist = Artist(slug="pin-artist", canonical_name="Pin Artist")
    db_session.add(artist)
    await db_session.commit()
    
    aw1 = Artwork(artist_id=artist.id, title="PinMe", source_page_url="http://a1", source_image_url="http://i1", image_original="o1", image_large="l1", image_thumb="t1", width=10, height=10, is_downloaded=True)
    db_session.add(aw1)
    await db_session.commit()

    response = await async_client.patch(f"/api/artworks/artworks/{aw1.id}/pin", cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    assert response.json()["is_pinned"] is True

    # Toggle again
    response = await async_client.patch(f"/api/artworks/artworks/{aw1.id}/pin", cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    assert response.json()["is_pinned"] is False
