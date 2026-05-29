import pytest
from fastapi_users.password import PasswordHelper
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

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
async def test_admin_list_users(async_client: AsyncClient, db_session: AsyncSession):
    user, cookies, csrf = await _create_and_login_user(async_client, db_session, "admin1@example.com", role="admin")
    response = await async_client.get("/auth/admin/users", cookies=cookies)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

@pytest.mark.asyncio
async def test_admin_update_user_role(async_client: AsyncClient, db_session: AsyncSession):
    admin_user, cookies, csrf = await _create_and_login_user(async_client, db_session, "admin2@example.com", role="admin")
    
    # Create a normal user
    pwd_helper = PasswordHelper()
    normal_user = User(
        email="normal@example.com",
        username="normal@example.com",
        hashed_password=pwd_helper.hash("testpass123"),
        is_active=True,
        is_superuser=False,
        is_verified=False,
        role="member",
    )
    db_session.add(normal_user)
    await db_session.commit()

    response = await async_client.patch(f"/auth/admin/users/{normal_user.id}/role", json={"role": "admin"}, cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    assert response.json()["role"] == "admin"

@pytest.mark.asyncio
async def test_admin_update_user_active(async_client: AsyncClient, db_session: AsyncSession):
    admin_user, cookies, csrf = await _create_and_login_user(async_client, db_session, "admin3@example.com", role="admin")
    
    pwd_helper = PasswordHelper()
    normal_user = User(
        email="normal2@example.com",
        username="normal2@example.com",
        hashed_password=pwd_helper.hash("testpass123"),
        is_active=True,
        is_superuser=False,
        is_verified=False,
        role="member",
    )
    db_session.add(normal_user)
    await db_session.commit()

    response = await async_client.patch(f"/auth/admin/users/{normal_user.id}/active", json={"is_active": False}, cookies=cookies, headers={"X-CSRF-Token": csrf})
    assert response.status_code == 200
    assert response.json()["is_active"] is False