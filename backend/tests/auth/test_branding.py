import os

from src.core.config import settings


class TestBranding:
    def test_cookie_name_is_artref_auth(self):
        assert settings.COOKIE_NAME == "artref_auth"

    def test_app_name_is_atelier(self):
        assert settings.app_name == "Atelier"

    def test_env_override_respected(self):
        try:
            os.environ["COOKIE_NAME"] = "custom_cookie"
            from src.core.config import Settings

            s = Settings()
            assert s.COOKIE_NAME == "custom_cookie"
        finally:
            os.environ.pop("COOKIE_NAME", None)
