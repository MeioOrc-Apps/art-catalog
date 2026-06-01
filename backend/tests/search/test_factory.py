import pytest


class TestFactory:
    def test_mock_when_provider_is_mock(self, monkeypatch):
        from src.core import config
        monkeypatch.setattr(config.settings, "image_search_provider", "mock")

        from src.search import get_provider
        from src.search.providers.mock import MockProvider

        provider = get_provider()
        assert isinstance(provider, MockProvider)

    def test_raises_on_unknown_provider(self, monkeypatch):
        from src.core import config
        monkeypatch.setattr(config.settings, "image_search_provider", "nonexistent")

        from src.search import get_provider

        with pytest.raises(ValueError, match="provider"):
            get_provider()

    def test_brave_provider(self, monkeypatch):
        from src.core import config
        monkeypatch.setattr(config.settings, "image_search_provider", "brave")
        monkeypatch.setattr(config.settings, "BRAVE_API_KEY", "test_key")
        
        from src.search import get_provider
        from src.search.providers.brave import BraveProvider
        
        provider = get_provider()
        assert isinstance(provider, BraveProvider)

    def test_serpapi_provider(self, monkeypatch):
        from src.core import config
        monkeypatch.setattr(config.settings, "image_search_provider", "serpapi")
        monkeypatch.setattr(config.settings, "SERPAPI_KEY", "test_key")
        
        from src.search import get_provider
        from src.search.providers.serpapi import SerpAPIProvider
        
        provider = get_provider()
        assert isinstance(provider, SerpAPIProvider)

    def test_google_cse_provider(self, monkeypatch):
        from src.core import config
        monkeypatch.setattr(config.settings, "image_search_provider", "google")
        monkeypatch.setattr(config.settings, "GOOGLE_CSE_KEY", "test_key")
        monkeypatch.setattr(config.settings, "GOOGLE_CSE_CX", "test_cx")
        
        from src.search import get_provider
        from src.search.providers.google import GoogleCSEProvider
        
        provider = get_provider()
        assert isinstance(provider, GoogleCSEProvider)
