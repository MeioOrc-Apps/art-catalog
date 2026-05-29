from fastapi_users.authentication import AuthenticationBackend, CookieTransport, JWTStrategy

from src.core.config import settings

cookie_transport = CookieTransport(
    cookie_name=settings.COOKIE_NAME,
    cookie_max_age=settings.COOKIE_MAX_AGE_SECONDS,
    cookie_secure=settings.COOKIE_SECURE,
    cookie_samesite=settings.COOKIE_SAMESITE,
    cookie_httponly=True,
)


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.JWT_SECRET,
        lifetime_seconds=settings.JWT_LIFETIME_SECONDS,
        algorithm=settings.JWT_ALGORITHM,
    )


auth_backend = AuthenticationBackend(
    name="cookie",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)
