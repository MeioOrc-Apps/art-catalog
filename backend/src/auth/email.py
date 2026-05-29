"""SMTP-backed transactional emails.

Single-purpose for now: password reset. Uses the stdlib `smtplib`
inside `asyncio.to_thread` to avoid pulling another async dep just
to send one email per hour. If volume ever grows, swap for
`aiosmtplib` without touching callers — the public surface is just
`send_password_reset_email`.

The HTML template is intentionally minimal (no inline CSS, no logo,
no images): renders the same in every client, no privacy-leaking
tracking pixels, no risk of mailto/href quoting bugs from a missing
templating engine.
"""
from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

import structlog

from src.core.config import settings

logger = structlog.get_logger()


def _build_reset_link(token: str) -> str:
    # APP_DOMAIN is e.g. "art.meioorc.com". In dev it's "localhost",
    # which produces a valid link the user can paste into their browser
    # against the dev frontend (which proxies /auth/* to the API).
    scheme = "http" if settings.APP_DOMAIN in ("localhost", "127.0.0.1") else "https"
    domain = settings.APP_DOMAIN
    if scheme == "http" and domain == "localhost":
        domain = "localhost:5173"
    return f"{scheme}://{domain}/reset-password?token={token}"


def _build_message(to_email: str, token: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = "Recuperação de senha — Save State"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = formataddr(("", to_email))

    link = _build_reset_link(token)
    lifetime_min = settings.PASSWORD_RESET_TOKEN_LIFETIME_SECONDS // 60

    msg.set_content(
        f"Você (ou alguém usando seu email) pediu redefinição de senha.\n\n"
        f"Clique no link abaixo para definir uma nova senha. O link expira "
        f"em {lifetime_min} minutos.\n\n"
        f"{link}\n\n"
        f"Se não foi você, ignore este email — sua senha continua a mesma."
    )
    msg.add_alternative(
        f"""<!doctype html>
<html><body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 24px auto; line-height: 1.5;">
  <p>Você (ou alguém usando seu email) pediu redefinição de senha.</p>
  <p><a href="{link}">Clique aqui para definir uma nova senha</a>. O link expira em {lifetime_min} minutos.</p>
  <p style="color: #666; font-size: 0.9em;">Se não foi você, ignore este email — sua senha continua a mesma.</p>
</body></html>""",
        subtype="html",
    )
    return msg


def _send_sync(msg: EmailMessage) -> None:
    """Blocking send — meant to run inside `asyncio.to_thread`."""
    if settings.SMTP_USE_SSL:
        client_cls = smtplib.SMTP_SSL
    else:
        client_cls = smtplib.SMTP

    with client_cls(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
            smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


async def send_password_reset_email(to_email: str, token: str) -> None:
    """Send the reset email. Errors are logged but never raised — the
    route always responds 202 to avoid leaking which addresses exist.
    """
    if not settings.PASSWORD_RESET_ENABLED:
        # Defensive: caller should have gated already, but if it
        # didn't, don't try to dial the SMTP server.
        logger.info("password_reset_email_skipped_disabled")
        return
    msg = _build_message(to_email, token)
    try:
        await asyncio.to_thread(_send_sync, msg)
        logger.info("password_reset_email_sent")
    except Exception as exc:  # noqa: BLE001
        logger.error("password_reset_email_failed", error=str(exc))
