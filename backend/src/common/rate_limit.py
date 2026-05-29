"""Shared slowapi limiter instance.

Defined in its own module so route handlers can register decorators
without importing from `src.main` (which would create a circular import).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from src.core.config import settings

# `enabled=False` short-circuits every `@limiter.limit(...)` decorator.
# Used by end-to-end test runs that hammer /auth/login dozens of times
# from the same loopback IP. Production rejects this flag in the
# settings validator, so flipping it accidentally fails fast at boot.
limiter = Limiter(key_func=get_remote_address, enabled=not settings.RATE_LIMITS_DISABLED)
