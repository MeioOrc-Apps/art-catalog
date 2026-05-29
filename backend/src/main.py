import secrets
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from src.artworks.router import router as artworks_router
from src.auth.routes import router as auth_router
from src.collections.router import router as collections_router
from src.common.rate_limit import limiter
from src.core.config import settings

logger = structlog.get_logger()

_CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
_CSRF_EXEMPT_PATHS = {
    "/auth/login",
    "/auth/register-with-invite",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/api/health",
}


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method not in _CSRF_SAFE_METHODS and request.url.path not in _CSRF_EXEMPT_PATHS:
            csrf_cookie = request.cookies.get(f"{settings.COOKIE_NAME}_csrf")
            csrf_header = request.headers.get("X-CSRF-Token")
            if not csrf_cookie or not csrf_header:
                return JSONResponse({"detail": "CSRF_TOKEN_MISSING"}, status_code=403)
            if not secrets.compare_digest(csrf_cookie, csrf_header):
                return JSONResponse({"detail": "CSRF_TOKEN_INVALID"}, status_code=403)
        return await call_next(request)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("api_started", environment=settings.ENVIRONMENT)
    await _bootstrap_first_admin()
    yield


async def _bootstrap_first_admin() -> None:
    import uuid

    from fastapi_users.password import PasswordHelper
    from sqlalchemy import select

    from src.auth.models import User
    from src.core import database
    from src.core.config import settings

    email = settings.FIRST_ADMIN_EMAIL
    password = settings.FIRST_ADMIN_PASSWORD

    if not email or not password:
        return

    async with database.async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none() is not None:
            logger.info("first_admin_already_exists", email=email)
            return

        helper = PasswordHelper()
        user = User(
            id=uuid.uuid4(),
            email=email,
            hashed_password=helper.hash(password),
            username=email.split("@")[0],
            role="admin",
            is_active=True,
            is_superuser=True,
            is_verified=True,
        )
        session.add(user)
        await session.commit()
        logger.info("first_admin_created", email=email, user_id=str(user.id))


app = FastAPI(
    title="Atelier",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
    openapi_url="/api/openapi.json" if settings.ENVIRONMENT != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)
app.add_middleware(CSRFMiddleware)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.include_router(auth_router)
app.include_router(artworks_router)
app.include_router(collections_router)

images_path = Path(settings.images_dir)
images_path.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(images_path)), name="images")


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "app": "Atelier"}
