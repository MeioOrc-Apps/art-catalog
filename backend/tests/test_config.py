import os

import pytest


@pytest.fixture(autouse=True)
def _clean_env():
    old = os.environ.get("APP_NAME")
    if old is not None:
        del os.environ["APP_NAME"]
    yield
    if old is not None:
        os.environ["APP_NAME"] = old
    else:
        os.environ.pop("APP_NAME", None)


def test_settings_loads_default_app_name():
    from src.core.config import Settings

    settings = Settings()
    assert settings.app_name == "Atelier"


def test_settings_respects_env_override():
    os.environ["APP_NAME"] = "CustomApp"

    from src.core.config import Settings

    settings = Settings()
    assert settings.app_name == "CustomApp"
