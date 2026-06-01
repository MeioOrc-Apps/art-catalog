"""Tests for startup bootstrap (_bootstrap_first_admin) and common utilities."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
class TestBootstrapFirstAdmin:
    async def test_creates_admin_when_not_exists(self, db_session: AsyncSession):
        import sqlalchemy

        from src.auth.models import User
        from src.core.config import settings
        from src.main import _bootstrap_first_admin

        test_email = "bootstrap_test_admin@example.com"
        # Ensure this user doesn't exist
        result = await db_session.execute(
            sqlalchemy.select(User).where(User.email == test_email)
        )
        existing = result.scalar_one_or_none()
        if existing:
            await db_session.delete(existing)
            await db_session.commit()

        original_email = settings.FIRST_ADMIN_EMAIL
        original_password = settings.FIRST_ADMIN_PASSWORD
        try:
            settings.FIRST_ADMIN_EMAIL = test_email
            settings.FIRST_ADMIN_PASSWORD = "BootstrapPass123!"
            await _bootstrap_first_admin()
        finally:
            settings.FIRST_ADMIN_EMAIL = original_email
            settings.FIRST_ADMIN_PASSWORD = original_password

        db_session.expunge_all()
        result = await db_session.execute(
            sqlalchemy.select(User).where(User.email == test_email)
        )
        user = result.scalar_one_or_none()
        assert user is not None
        assert user.role == "admin"
        assert user.is_active is True

    async def test_skips_when_admin_already_exists(self, db_session: AsyncSession):
        import sqlalchemy

        from src.auth.models import User
        from src.core.config import settings
        from src.main import _bootstrap_first_admin

        test_email = "bootstrap_existing@example.com"
        from fastapi_users.password import PasswordHelper
        user = User(
            email=test_email,
            username="bootstrap_existing",
            hashed_password=PasswordHelper().hash("pass123"),
            is_active=True,
            is_superuser=True,
            is_verified=True,
            role="admin",
        )
        db_session.add(user)
        await db_session.commit()

        original_email = settings.FIRST_ADMIN_EMAIL
        original_password = settings.FIRST_ADMIN_PASSWORD
        try:
            settings.FIRST_ADMIN_EMAIL = test_email
            settings.FIRST_ADMIN_PASSWORD = "ShouldNotChange!"
            # Should complete without error, not create duplicate
            await _bootstrap_first_admin()
        finally:
            settings.FIRST_ADMIN_EMAIL = original_email
            settings.FIRST_ADMIN_PASSWORD = original_password

        db_session.expunge_all()
        result = await db_session.execute(
            sqlalchemy.select(User).where(User.email == test_email)
        )
        users = result.scalars().all()
        assert len(users) == 1  # no duplicate created

    async def test_skips_when_env_vars_missing(self, db_session: AsyncSession):
        from src.core.config import settings
        from src.main import _bootstrap_first_admin

        original_email = settings.FIRST_ADMIN_EMAIL
        original_password = settings.FIRST_ADMIN_PASSWORD
        try:
            settings.FIRST_ADMIN_EMAIL = ""
            settings.FIRST_ADMIN_PASSWORD = ""
            # Should return early without error
            await _bootstrap_first_admin()
        finally:
            settings.FIRST_ADMIN_EMAIL = original_email
            settings.FIRST_ADMIN_PASSWORD = original_password


async def _make_admin(db_session: AsyncSession, email: str):
    import uuid

    from fastapi_users.password import PasswordHelper

    from src.auth.models import User

    user = User(
        id=uuid.uuid4(),
        email=email,
        username=email.split("@")[0],
        hashed_password=PasswordHelper().hash("pass"),
        is_active=True,
        is_superuser=True,
        is_verified=True,
        role="admin",
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.mark.asyncio
class TestReserveInviteEdgeCases:
    async def test_reserve_invite_already_used_raises_conflict(
        self, db_session: AsyncSession
    ):
        from src.auth.invites import create_invite, reserve_invite
        from src.common.exceptions import ConflictError

        admin = await _make_admin(db_session, "res_conflict@test.com")
        invite = await create_invite(
            db_session, created_by=admin.id, expires_in_days=7
        )
        code = invite.code

        await reserve_invite(db_session, code)

        with pytest.raises(ConflictError):
            await reserve_invite(db_session, code)

    async def test_reserve_invite_not_found_raises(self, db_session: AsyncSession):
        from src.auth.invites import reserve_invite
        from src.common.exceptions import NotFoundError

        with pytest.raises(NotFoundError):
            await reserve_invite(db_session, "nonexistent-code-xyz")

    async def test_list_invites_returns_list(self, db_session: AsyncSession):
        from src.auth.invites import create_invite, list_invites

        admin = await _make_admin(db_session, "list_inv@test.com")
        await create_invite(db_session, created_by=admin.id, expires_in_days=7)

        invites = await list_invites(db_session)
        assert isinstance(invites, list)
        assert len(invites) >= 1

    async def test_revoke_invite_not_found_raises(self, db_session: AsyncSession):
        import uuid

        from src.auth.invites import revoke_invite
        from src.common.exceptions import NotFoundError

        with pytest.raises(NotFoundError):
            await revoke_invite(db_session, uuid.uuid4())
