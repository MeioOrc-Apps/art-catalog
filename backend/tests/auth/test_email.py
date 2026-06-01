"""Tests for auth/email.py helper functions and send path."""
import pytest


class TestBuildResetLink:
    def test_localhost_uses_http_with_port(self, monkeypatch):
        from src.core.config import settings
        monkeypatch.setattr(settings, "APP_DOMAIN", "localhost")

        from src.auth.email import _build_reset_link
        link = _build_reset_link("abc123")
        assert link.startswith("http://localhost:5173/reset-password?token=abc123")

    def test_production_domain_uses_https(self, monkeypatch):
        from src.core.config import settings
        monkeypatch.setattr(settings, "APP_DOMAIN", "art.example.com")

        from src.auth.email import _build_reset_link
        link = _build_reset_link("tok")
        assert link.startswith("https://art.example.com/reset-password?token=tok")

    def test_127_0_0_1_uses_http(self, monkeypatch):
        from src.core.config import settings
        monkeypatch.setattr(settings, "APP_DOMAIN", "127.0.0.1")

        from src.auth.email import _build_reset_link
        link = _build_reset_link("t")
        assert link.startswith("http://")


class TestBuildMessage:
    def test_message_has_correct_headers(self, monkeypatch):
        from src.core.config import settings
        monkeypatch.setattr(settings, "APP_DOMAIN", "localhost")
        monkeypatch.setattr(settings, "SMTP_FROM", "noreply@art.test")
        monkeypatch.setattr(settings, "PASSWORD_RESET_TOKEN_LIFETIME_SECONDS", 1800)

        from src.auth.email import _build_message
        msg = _build_message("user@example.com", "mytoken")

        assert msg["To"] == "user@example.com"
        assert msg["From"] == "noreply@art.test"
        assert "mytoken" in msg.get_payload(decode=False) or "mytoken" in str(msg)

    def test_message_contains_token_in_link(self, monkeypatch):
        from src.core.config import settings
        monkeypatch.setattr(settings, "APP_DOMAIN", "localhost")
        monkeypatch.setattr(settings, "SMTP_FROM", "noreply@art.test")
        monkeypatch.setattr(settings, "PASSWORD_RESET_TOKEN_LIFETIME_SECONDS", 600)

        from src.auth.email import _build_message
        msg = _build_message("user@example.com", "special-token-xyz")
        raw = msg.as_string()
        assert "special-token-xyz" in raw


@pytest.mark.asyncio
class TestSendPasswordResetEmail:
    async def test_disabled_feature_returns_early(self, monkeypatch):
        from src.core.config import settings
        monkeypatch.setattr(settings, "PASSWORD_RESET_ENABLED", False)

        from src.auth.email import send_password_reset_email
        # Should complete without error and without touching SMTP
        await send_password_reset_email("user@example.com", "tok")

    async def test_smtp_failure_is_swallowed(self, monkeypatch):
        from src.core.config import settings
        monkeypatch.setattr(settings, "PASSWORD_RESET_ENABLED", True)
        monkeypatch.setattr(settings, "APP_DOMAIN", "localhost")
        monkeypatch.setattr(settings, "SMTP_FROM", "noreply@art.test")
        monkeypatch.setattr(settings, "SMTP_HOST", "127.0.0.1")
        monkeypatch.setattr(settings, "SMTP_PORT", 19999)  # nothing listening
        monkeypatch.setattr(settings, "SMTP_USE_SSL", False)
        monkeypatch.setattr(settings, "SMTP_USE_TLS", False)
        monkeypatch.setattr(settings, "SMTP_USER", "")
        monkeypatch.setattr(settings, "PASSWORD_RESET_TOKEN_LIFETIME_SECONDS", 600)

        from src.auth.email import send_password_reset_email
        # Must not raise even if connection is refused
        await send_password_reset_email("user@example.com", "tok")
