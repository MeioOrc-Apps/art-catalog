import uuid
from collections.abc import AsyncGenerator

import structlog
from fastapi import Depends
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.auth.strategies import auth_backend
from src.core.database import get_async_session

logger = structlog.get_logger()


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret: str
    verification_token_secret: str

    def __init__(self, user_db: SQLAlchemyUserDatabase, secret: str):
        super().__init__(user_db)
        self.reset_password_token_secret = secret
        self.verification_token_secret = secret
        from src.core.config import settings

        # Override fastapi-users' 3600s default with our configurable
        # lifetime so an admin can shorten the reset window.
        self.reset_password_token_lifetime_seconds = (
            settings.PASSWORD_RESET_TOKEN_LIFETIME_SECONDS
        )

    async def on_after_register(self, user: User, request=None) -> None:
        logger.info("user_registered", user_id=str(user.id), username=user.username)

    async def on_after_forgot_password(self, user: User, token: str, request=None) -> None:
        logger.info("password_reset_requested", user_id=str(user.id))
        from src.auth.email import send_password_reset_email
        from src.core.config import settings

        if settings.PASSWORD_RESET_ENABLED:
            await send_password_reset_email(user.email, token)

    async def on_after_reset_password(self, user: User, request=None) -> None:
        logger.info("password_reset_completed", user_id=str(user.id))


async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
) -> AsyncGenerator[SQLAlchemyUserDatabase, None]:
    yield SQLAlchemyUserDatabase(session, User)


async def get_user_manager(
    user_db: SQLAlchemyUserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    from src.core.config import settings

    yield UserManager(user_db, settings.JWT_SECRET)


fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
