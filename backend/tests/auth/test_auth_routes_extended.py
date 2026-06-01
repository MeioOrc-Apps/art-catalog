"""Tests for auth routes not covered by test_auth_flows.py."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_and_login(
    async_client: AsyncClient, db_session: AsyncSession, email: str = "routeext@test.com"
) -> tuple:
    from tests.auth.test_admin import _create_and_login_user
    return await _create_and_login_user(async_client, db_session, email)


@pytest.mark.asyncio
class TestUpdateMe:
    async def test_patch_me_updates_display_name(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        user, cookies, csrf = await _create_and_login(
            async_client, db_session, "patch_me@test.com"
        )
        resp = await async_client.patch(
            "/auth/me",
            json={"display_name": "New Display Name"},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "New Display Name"

    async def test_patch_me_empty_body_noop(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        user, cookies, csrf = await _create_and_login(
            async_client, db_session, "patch_me_empty@test.com"
        )
        resp = await async_client.patch(
            "/auth/me",
            json={},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200

    async def test_patch_me_requires_auth(self, async_client: AsyncClient):
        resp = await async_client.patch("/auth/me", json={"display_name": "X"})
        assert resp.status_code in (401, 403)


@pytest.mark.asyncio
class TestForgotPassword:
    async def test_forgot_password_disabled_returns_503(
        self, async_client: AsyncClient, monkeypatch
    ):
        from src.core.config import settings
        monkeypatch.setattr(settings, "PASSWORD_RESET_ENABLED", False)

        resp = await async_client.post(
            "/auth/forgot-password", json={"email": "anyone@test.com"}
        )
        assert resp.status_code == 503
        assert resp.json()["detail"] == "PASSWORD_RESET_NOT_AVAILABLE"

    async def test_forgot_password_nonexistent_email_still_202(
        self, async_client: AsyncClient, db_session: AsyncSession, monkeypatch
    ):
        from src.core.config import settings
        monkeypatch.setattr(settings, "PASSWORD_RESET_ENABLED", True)
        monkeypatch.setattr(settings, "APP_DOMAIN", "localhost")
        monkeypatch.setattr(settings, "SMTP_HOST", "127.0.0.1")
        monkeypatch.setattr(settings, "SMTP_PORT", 19999)
        monkeypatch.setattr(settings, "SMTP_USE_SSL", False)
        monkeypatch.setattr(settings, "SMTP_USE_TLS", False)
        monkeypatch.setattr(settings, "SMTP_USER", "")
        monkeypatch.setattr(settings, "SMTP_FROM", "noreply@test.com")
        monkeypatch.setattr(settings, "PASSWORD_RESET_TOKEN_LIFETIME_SECONDS", 600)

        resp = await async_client.post(
            "/auth/forgot-password",
            json={"email": "nobody@doesnotexist.example.com"},
        )
        # Should return 202 regardless (anti-enumeration)
        assert resp.status_code == 202


@pytest.mark.asyncio
class TestResetPassword:
    async def test_reset_password_disabled_returns_503(
        self, async_client: AsyncClient, monkeypatch
    ):
        from src.core.config import settings
        monkeypatch.setattr(settings, "PASSWORD_RESET_ENABLED", False)

        resp = await async_client.post(
            "/auth/reset-password",
            json={"token": "anytoken", "password": "newpass123"},
        )
        assert resp.status_code == 503

    async def test_reset_password_invalid_token_returns_400(
        self, async_client: AsyncClient, monkeypatch
    ):
        from src.core.config import settings
        monkeypatch.setattr(settings, "PASSWORD_RESET_ENABLED", True)
        monkeypatch.setattr(settings, "PASSWORD_RESET_TOKEN_LIFETIME_SECONDS", 600)

        resp = await async_client.post(
            "/auth/reset-password",
            json={"token": "invalid-token-xyz", "password": "newpass123"},
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "RESET_PASSWORD_FAILED"


@pytest.mark.asyncio
class TestAdminInvites:
    async def test_admin_list_invites(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        from tests.auth.test_admin import _create_and_login_user
        _, cookies, _ = await _create_and_login_user(
            async_client, db_session, "inv_list_admin@test.com", role="admin"
        )

        resp = await async_client.get("/auth/admin/invites", cookies=cookies)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_admin_revoke_invite(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        from tests.auth.test_admin import _create_and_login_user
        _, cookies, csrf = await _create_and_login_user(
            async_client, db_session, "inv_revoke_admin@test.com", role="admin"
        )

        # Create an invite first
        create_resp = await async_client.post(
            "/auth/admin/invites",
            json={"email_hint": None, "expires_in_days": 7},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert create_resp.status_code == 201
        invite_id = create_resp.json()["id"]

        # Revoke it
        revoke_resp = await async_client.delete(
            f"/auth/admin/invites/{invite_id}",
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        assert revoke_resp.status_code == 204


@pytest.mark.asyncio
class TestRegisterWithInviteErrors:
    async def _admin_create_invite(
        self, async_client: AsyncClient, db_session: AsyncSession, email_hint: str | None = None
    ) -> str:
        from tests.auth.test_admin import _create_and_login_user
        _, cookies, csrf = await _create_and_login_user(
            async_client, db_session, f"reg_admin_{id(self)}@test.com", role="admin"
        )
        resp = await async_client.post(
            "/auth/admin/invites",
            json={"email_hint": email_hint, "expires_in_days": 7},
            cookies=cookies,
            headers={"X-CSRF-Token": csrf},
        )
        return resp.json()["code"]

    async def test_register_invalid_invite_code(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        resp = await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": "invalid-code-xyz-123",
                "email": "new@example.com",
                "password": "StrongPass123!",
                "username": "newuser",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "INVITE_INVALID"

    async def test_register_already_used_invite(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        code = await self._admin_create_invite(async_client, db_session)

        # First registration uses it up
        r1 = await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": code,
                "email": "first_reg@example.com",
                "password": "StrongPass123!",
                "username": "first_reg_user",
            },
        )
        assert r1.status_code == 201

        # Second attempt with same code
        r2 = await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": code,
                "email": "second_reg@example.com",
                "password": "StrongPass123!",
                "username": "second_reg_user",
            },
        )
        assert r2.status_code == 400
        assert r2.json()["detail"] in ("INVITE_ALREADY_USED", "INVITE_INVALID")

    async def test_register_duplicate_email_returns_400(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        from tests.auth.test_admin import _create_and_login_user
        # Create an existing user
        await _create_and_login_user(async_client, db_session, "dup_email@example.com")

        code = await self._admin_create_invite(async_client, db_session)

        resp = await async_client.post(
            "/auth/register-with-invite",
            json={
                "code": code,
                "email": "dup_email@example.com",
                "password": "StrongPass123!",
                "username": "someother_user_dup",
            },
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] in (
            "REGISTER_USER_ALREADY_EXISTS",
            "REGISTER_FAILED",
            "INVITE_ALREADY_USED",
            "INVITE_INVALID",
        )
