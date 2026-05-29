import secrets
import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.invites import (
    attach_invite_to_user,
    create_invite,
    list_invites,
    release_invite,
    reserve_invite,
    revoke_invite,
)
from src.auth.manager import UserManager, current_active_user, get_user_manager
from src.auth.models import User
from src.auth.schemas import (
    ForgotPasswordRequest,
    InviteCreate,
    InviteRead,
    MeUpdate,
    RegisterWithInviteRequest,
    ResetPasswordRequest,
    UserCreate,
    UserRead,
)
from src.auth.strategies import auth_backend, get_jwt_strategy
from src.common.rate_limit import limiter
from src.core.config import settings
from src.core.database import get_async_session
from src.core.deps import require_admin

logger = structlog.get_logger()

router = APIRouter(prefix="/auth", tags=["auth"])

# SPEC §5.1 — defense against credential stuffing/brute force.
# Skipped entirely in tests so we don't have to mock IP plumbing.
_LOGIN_LIMIT = "5/5minutes"
_REGISTER_LIMIT = "10/hour"
_PASSWORD_RESET_LIMIT = "3/hour"


def _set_csrf_cookie(response, token: str) -> None:
    response.set_cookie(
        key=f"{settings.COOKIE_NAME}_csrf",
        value=token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.COOKIE_MAX_AGE_SECONDS,
    )


def _clear_auth_cookies(response) -> None:
    response.delete_cookie(settings.COOKIE_NAME)
    response.delete_cookie(f"{settings.COOKIE_NAME}_csrf")


@router.post("/login")
@limiter.limit(_LOGIN_LIMIT)
async def login(
    request: Request,
    credentials: OAuth2PasswordRequestForm = Depends(),
    user_manager: UserManager = Depends(get_user_manager),
    strategy=Depends(get_jwt_strategy),
    session: AsyncSession = Depends(get_async_session),
):
    user = await user_manager.authenticate(credentials)
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="LOGIN_BAD_CREDENTIALS")

    response = await auth_backend.login(strategy, user)

    csrf_token = secrets.token_urlsafe(32)
    _set_csrf_cookie(response, csrf_token)

    await session.execute(
        update(User).where(User.id == user.id).values(last_login_at=datetime.now(UTC))
    )
    await session.commit()

    logger.info("user_logged_in", user_id=str(user.id))
    return response


@router.post("/logout")
async def logout(
    request: Request,
    user: User = Depends(current_active_user),
    strategy=Depends(get_jwt_strategy),
):
    token = request.cookies.get(settings.COOKIE_NAME, "")
    response = await auth_backend.logout(strategy, user, token)
    _clear_auth_cookies(response)
    logger.info("user_logged_out", user_id=str(user.id))
    return response


@router.post("/register-with-invite", response_model=UserRead, status_code=201)
@limiter.limit(_REGISTER_LIMIT)
async def register_with_invite(
    request: Request,
    body: RegisterWithInviteRequest,
    user_manager: UserManager = Depends(get_user_manager),
    session: AsyncSession = Depends(get_async_session),
):
    """Race-safe registration.

    Two clients calling this endpoint with the same code at the same
    instant could both pass a naive `used_at IS NULL` check and create
    two users from one invite. We avoid that by claiming the invite
    with a conditional UPDATE *before* creating the user; if the user
    creation fails we release the reservation so the invite remains
    usable.
    """
    from src.common.exceptions import ConflictError, NotFoundError, ValidationError

    try:
        await reserve_invite(session, body.code, email=body.email)
    except NotFoundError:
        raise HTTPException(400, "INVITE_INVALID")
    except ConflictError:
        raise HTTPException(400, "INVITE_ALREADY_USED")
    except ValidationError as exc:
        if "mismatch" in str(exc).lower():
            raise HTTPException(400, "INVITE_EMAIL_MISMATCH")
        raise HTTPException(400, "INVITE_EXPIRED")

    try:
        user = await user_manager.create(
            UserCreate(
                email=body.email,
                password=body.password,
                username=body.username,
                display_name=body.display_name,
                locale=body.locale,
            )
        )
    except Exception as exc:
        # Compensate: free the invite so a retry can succeed.
        try:
            await release_invite(session, body.code)
        except Exception:
            logger.warning("invite_release_failed", code=body.code[:8])
        detail = str(exc)
        if "REGISTER_USER_ALREADY_EXISTS" in detail or "already exists" in detail.lower():
            raise HTTPException(400, "REGISTER_USER_ALREADY_EXISTS")
        raise HTTPException(400, "REGISTER_FAILED")

    await attach_invite_to_user(session, body.code, user.id)
    logger.info("user_registered_with_invite", user_id=str(user.id))
    return user


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(current_active_user)):
    return user


@router.patch("/me", response_model=UserRead)
async def update_me(
    body: MeUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Self-service profile patch. Locale lives here so the language
    toggle in the UI persists server-side — that way a user keeps
    their language choice across browsers/devices instead of just
    the local cookie. Any field not present in the body is left
    untouched (PATCH semantics, not PUT)."""
    payload = body.model_dump(exclude_unset=True)
    if not payload:
        return user
    for field, value in payload.items():
        setattr(user, field, value)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@router.get("/me/quotas")
async def me_quotas(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
):
    from src.auth.quotas import get_user_quota_status
    return await get_user_quota_status(session, user.id)


@router.post("/forgot-password")
@limiter.limit(_PASSWORD_RESET_LIMIT)
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    user_manager: UserManager = Depends(get_user_manager),
):
    """Initiate password recovery.

    Returns 503 when ``PASSWORD_RESET_ENABLED`` is False (no SMTP
    configured). Otherwise always returns 202 — never reveals whether
    the email exists, to neutralize email enumeration attacks.
    """
    if not settings.PASSWORD_RESET_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="PASSWORD_RESET_NOT_AVAILABLE",
        )

    try:
        user = await user_manager.get_by_email(body.email)
        await user_manager.forgot_password(user)
    except Exception:
        # Swallow UserNotExists and any transient SMTP issue. The
        # email send itself logs failures; the user-facing response
        # is identical either way.
        logger.info("password_reset_request_received")
    return JSONResponse(
        status_code=202,
        content={"detail": "If that email exists, a reset link was sent"},
    )


@router.post("/reset-password", status_code=200)
@limiter.limit(_PASSWORD_RESET_LIMIT)
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    user_manager: UserManager = Depends(get_user_manager),
):
    if not settings.PASSWORD_RESET_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="PASSWORD_RESET_NOT_AVAILABLE",
        )

    try:
        await user_manager.reset_password(body.token, body.password)
    except Exception as exc:
        # Don't leak fastapi-users internals (which token field was bad,
        # whether it expired vs. was tampered, etc.).
        logger.warning("password_reset_failed", error=str(exc))
        raise HTTPException(400, "RESET_PASSWORD_FAILED")
    return {"detail": "Password updated"}


# --- Admin invite management ---

@router.post("/admin/invites", response_model=InviteRead, status_code=201)
async def admin_create_invite(
    body: InviteCreate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    invite = await create_invite(
        session,
        created_by=admin.id,
        email_hint=body.email_hint,
        expires_in_days=body.expires_in_days,
    )
    return invite


@router.get("/admin/invites", response_model=list[InviteRead])
async def admin_list_invites(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    return await list_invites(session)


@router.delete("/admin/invites/{invite_id}", status_code=204)
async def admin_revoke_invite(
    invite_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    await revoke_invite(session, invite_id)


# --- Admin user management ---

@router.get("/admin/users", response_model=list[UserRead])
async def admin_list_users(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


class UserRoleUpdate(BaseModel):
    role: str

@router.patch("/admin/users/{user_id}/role", response_model=UserRead)
async def admin_update_user_role(
    user_id: uuid.UUID,
    body: UserRoleUpdate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    if body.role not in ("admin", "member"):
        raise HTTPException(400, "Cargo inválido")
    if user_id == admin.id:
        raise HTTPException(400, "Você não pode alterar seu próprio cargo")
    
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuário não encontrado")
        
    user.role = body.role
    await session.commit()
    return user


class UserActiveUpdate(BaseModel):
    is_active: bool

@router.patch("/admin/users/{user_id}/active", response_model=UserRead)
async def admin_update_user_active(
    user_id: uuid.UUID,
    body: UserActiveUpdate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    if user_id == admin.id:
        raise HTTPException(400, "Você não pode desativar a si mesmo")
        
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Usuário não encontrado")
        
    user.is_active = body.is_active
    await session.commit()
    return user


