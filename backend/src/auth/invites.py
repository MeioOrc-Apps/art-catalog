import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import Invite
from src.common.exceptions import ConflictError, NotFoundError, ValidationError


async def create_invite(
    session: AsyncSession,
    created_by: uuid.UUID,
    email_hint: str | None = None,
    expires_in_days: int = 7,
) -> Invite:
    code = secrets.token_urlsafe(32)
    invite = Invite(
        code=code,
        created_by=created_by,
        email_hint=email_hint,
        expires_at=datetime.now(UTC) + timedelta(days=expires_in_days),
    )
    session.add(invite)
    await session.commit()
    await session.refresh(invite)
    return invite


async def get_invite_by_code(session: AsyncSession, code: str) -> Invite:
    result = await session.execute(select(Invite).where(Invite.code == code))
    invite = result.scalar_one_or_none()
    if invite is None:
        raise NotFoundError("Invite")
    return invite


async def reserve_invite(
    session: AsyncSession, code: str, email: str | None = None
) -> Invite:
    """Atomically claim an invite (race-safe).

    Performs a conditional UPDATE that only succeeds if the invite is
    unused AND not expired. If the update affects zero rows we run a
    follow-up lookup to produce a precise error (NotFound / Conflict /
    Validation).

    Postcondition on success: `used_at` is set; `used_by` is still NULL
    and must be filled by the caller via :func:`attach_invite_to_user`
    after the dependent user row is created.
    """
    # Validate email_hint before reserving. email_hint is immutable so
    # checking it before the UPDATE has no race implications.
    if email is not None:
        invite = await get_invite_by_code(session, code)  # raises NotFound
        if invite.email_hint and invite.email_hint.lower() != email.lower():
            raise ValidationError("Invite email mismatch")

    now = datetime.now(UTC)
    stmt = (
        update(Invite)
        .where(
            Invite.code == code,
            Invite.used_at.is_(None),
            Invite.expires_at > now,
        )
        .values(used_at=now)
    )
    result = await session.execute(stmt)
    if result.rowcount == 0:
        invite = await get_invite_by_code(session, code)  # raises NotFound
        if invite.used_at is not None:
            raise ConflictError("Invite already used")
        raise ValidationError("Invite expired")
    await session.commit()

    # Re-fetch with the new state so the caller sees `used_at` filled
    return await get_invite_by_code(session, code)


async def attach_invite_to_user(
    session: AsyncSession, code: str, user_id: uuid.UUID
) -> None:
    """Stamp `used_by` on an already-reserved invite."""
    await session.execute(
        update(Invite).where(Invite.code == code).values(used_by=user_id)
    )
    await session.commit()


async def release_invite(session: AsyncSession, code: str) -> None:
    """Undo a reservation. Used to compensate when user creation fails
    after the invite was claimed.
    """
    await session.execute(
        update(Invite)
        .where(Invite.code == code)
        .values(used_at=None, used_by=None)
    )
    await session.commit()


async def validate_and_consume_invite(
    session: AsyncSession, code: str, used_by: uuid.UUID
) -> Invite:
    """Backwards-compatible single-shot consume. Prefer the two-step
    `reserve_invite` + `attach_invite_to_user` for new code paths, since
    that is race-safe across concurrent requests.
    """
    invite = await reserve_invite(session, code)
    await attach_invite_to_user(session, code, used_by)
    return await get_invite_by_code(session, code)


async def list_invites(session: AsyncSession) -> list[Invite]:
    result = await session.execute(select(Invite).order_by(Invite.created_at.desc()))
    return list(result.scalars().all())


async def revoke_invite(session: AsyncSession, invite_id: uuid.UUID) -> None:
    result = await session.execute(select(Invite).where(Invite.id == invite_id))
    invite = result.scalar_one_or_none()
    if invite is None:
        raise NotFoundError("Invite")
    if invite.used_at is not None:
        raise ConflictError("Cannot revoke a used invite")
    await session.delete(invite)
    await session.commit()
