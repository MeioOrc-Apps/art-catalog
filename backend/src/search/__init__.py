from src.core.config import settings
from src.search.base import ImageSearchProvider
from src.search.providers.mock import MockProvider


def get_provider() -> ImageSearchProvider:
    match settings.image_search_provider:
        case "mock":
            return MockProvider()
        case "brave":
            from src.search.providers.brave import BraveProvider
            if not settings.BRAVE_API_KEY:
                raise RuntimeError("BRAVE_API_KEY ausente")
            return BraveProvider(settings.BRAVE_API_KEY)
        case "serpapi":
            from src.search.providers.serpapi import SerpAPIProvider
            if not settings.SERPAPI_KEY:
                raise RuntimeError("SERPAPI_KEY ausente")
            return SerpAPIProvider(settings.SERPAPI_KEY)
        case "google":
            from src.search.providers.google import GoogleCSEProvider
            if not settings.GOOGLE_CSE_KEY or not settings.GOOGLE_CSE_CX:
                raise RuntimeError("GOOGLE_CSE_KEY ou GOOGLE_CSE_CX ausente")
            return GoogleCSEProvider(settings.GOOGLE_CSE_KEY, settings.GOOGLE_CSE_CX)
        case "duckduckgo":
            from src.search.providers.duckduckgo import DuckDuckGoProvider
            return DuckDuckGoProvider()
        case _:
            raise ValueError(f"provider desconhecido: {settings.image_search_provider}")
