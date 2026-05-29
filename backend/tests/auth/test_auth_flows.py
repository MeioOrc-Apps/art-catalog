import uuid as _uuid

import pytest
from fastapi_users.password import PasswordHelper
from sqlalchemy import select

from src.auth.models import User


@pytest.mark.asyncio
class TestLoginFlow:
    async def test_login_sets_cookie_and_returns_204(
        self, async_client, db_session
    ):
        await _create_test_user(db_session, "login-test@example.com", "testpass123")

        response = await async_client.post(
            "/auth/login",
            data={"username": "login-test@example.com", "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        assert response.status_code == 204
        assert "artref_auth" in response.cookies
        assert response.cookies["artref_auth"] != ""
        assert 'httponly' in str(response.headers.get("set-cookie", "")).lower()

    async def test_login_bad_credentials_returns_400(self, async_client):
        response = await async_client.post(
            "/auth/login",
            data={"username": "nonexistent@x.com", "password": "wrong"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "LOGIN_BAD_CREDENTIALS"

    async def test_me_endpoint_returns_user(self, async_client, db_session):
        await _create_test_user(db_session, "me-test@example.com", "testpass123")

        login_resp = await async_client.post(
            "/auth/login",
            data={"username": "me-test@example.com", "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        cookies = login_resp.cookies

        response = await async_client.get("/auth/me", cookies=cookies)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "me-test@example.com"
        assert data["role"] == "member"


@pytest.mark.asyncio
class TestLogout:
    async def test_logout_clears_cookie(self, async_client, db_session):
        await _create_test_user(db_session, "logout-test@example.com", "testpass123")

        login_resp = await async_client.post(
            "/auth/login",
            data={"username": "logout-test@example.com", "password": "testpass123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        cookies = login_resp.cookies
        csrf = cookies.get("artref_auth_csrf", "")

        response = await async_client.post(
            "/auth/logout", cookies=cookies, headers={"X-CSRF-Token": csrf}
        )
        assert response.status_code == 204


@pytest.mark.asyncio
class TestInviteFlow:
    async def test_admin_creates_invite(self, async_client, db_session):
        admin_cookies = await _login_admin(async_client, db_session)
        csrf = admin_cookies.get("artref_auth_csrf", "")

        response = await async_client.post(
            "/auth/admin/invites",
            cookies=admin_cookies,
            json={"email_hint": "invited@example.com"},
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 201
        data = response.json()
        assert "code" in data
        assert data["email_hint"] == "invited@example.com"

    async def test_member_registers_with_valid_invite(
        self, async_client, db_session
    ):
        admin_cookies = await _login_admin(async_client, db_session)
        csrf = admin_cookies.get("artref_auth_csrf", "")

        invite_resp = await async_client.post(
            "/auth/admin/invites",
            cookies=admin_cookies,
            json={"email_hint": "member@example.com"},
            headers={"X-CSRF-Token": csrf},
        )
        code = invite_resp.json()["code"]

        response = await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": code,
                "email": "member@example.com",
                "password": "mypassword123",
                "username": "newmember",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "member@example.com"
        assert data["role"] == "member"

        result = await db_session.execute(
            select(User).where(User.email == "member@example.com")
        )
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.role == "member"

    async def test_invite_cannot_be_used_twice(self, async_client, db_session):
        admin_cookies = await _login_admin(async_client, db_session)
        csrf = admin_cookies.get("artref_auth_csrf", "")

        invite_resp = await async_client.post(
            "/auth/admin/invites",
            cookies=admin_cookies,
            json={"email_hint": "twice@example.com"},
            headers={"X-CSRF-Token": csrf},
        )
        code = invite_resp.json()["code"]

        await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": code,
                "email": "first@example.com",
                "password": "pass123456",
                "username": "firstuser",
            },
        )

        response = await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": code,
                "email": "second@example.com",
                "password": "pass654321",
                "username": "seconduser",
            },
        )
        assert response.status_code == 400


@pytest.mark.asyncio
class TestCSRF:
    async def test_mutating_route_without_csrf_returns_403(self, async_client):
        response = await async_client.post(
            "/auth/admin/invites",
            json={"email_hint": "csrf-test@example.com"},
        )
        assert response.status_code == 403

    async def test_mutating_route_with_csrf_works(self, async_client, db_session):
        admin_cookies = await _login_admin(async_client, db_session)
        csrf = admin_cookies.get("artref_auth_csrf", "")

        response = await async_client.post(
            "/auth/admin/invites",
            cookies=admin_cookies,
            json={"email_hint": "csrf-ok@example.com"},
            headers={"X-CSRF-Token": csrf},
        )
        assert response.status_code == 201


@pytest.mark.asyncio
class TestRoleGuard:
    async def test_member_cannot_access_admin_route(
        self, async_client, db_session
    ):
        admin_cookies = await _login_admin(async_client, db_session)
        admin_csrf = admin_cookies.get("artref_auth_csrf", "")

        invite_resp = await async_client.post(
            "/auth/admin/invites",
            cookies=admin_cookies,
            json={"email_hint": "guard@example.com"},
            headers={"X-CSRF-Token": admin_csrf},
        )
        code = invite_resp.json()["code"]

        await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": code,
                "email": "guard@example.com",
                "password": "pass123456",
                "username": "guarduser",
            },
        )

        login_resp = await async_client.post(
            "/auth/login",
            data={"username": "guard@example.com", "password": "pass123456"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        member_cookies = login_resp.cookies
        member_csrf = member_cookies.get("artref_auth_csrf", "")

        response = await async_client.post(
            "/auth/admin/invites",
            cookies=member_cookies,
            json={"email_hint": "blocked@example.com"},
            headers={"X-CSRF-Token": member_csrf},
        )
        assert response.status_code == 403


async def _create_test_user(
    db_session, email: str, password: str, role: str = "member"
) -> User:
    result = await db_session.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    helper = PasswordHelper()
    user = User(
        id=_uuid.uuid4(),
        email=email,
        hashed_password=helper.hash(password),
        username=email.split("@")[0],
        role=role,
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _login_admin(async_client, db_session) -> dict:
    await _create_test_user(db_session, "admin-test@example.com", "adminpass", role="admin")
    response = await async_client.post(
        "/auth/login",
        data={"username": "admin-test@example.com", "password": "adminpass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return dict(response.cookies)


async def _ensure_admin(db_session):
    result = await db_session.execute(
        select(User).where(User.email == "admin-test@example.com")
    )
    admin = result.scalar_one_or_none()
    if not admin:
        import uuid as _uuid
        helper = PasswordHelper()
        admin = User(
            id=_uuid.uuid4(),
            email="admin-test@example.com",
            hashed_password=helper.hash("adminpass"),
            username="admintest",
            role="admin",
            is_active=True,
            is_superuser=True,
            is_verified=True,
        )
        db_session.add(admin)
        await db_session.commit()
        await db_session.refresh(admin)
    return admin
