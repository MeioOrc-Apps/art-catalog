import httpx
import pytest
import respx

from src.search.providers.serpapi import SerpAPIProvider


class TestSerpAPIProvider:
    @pytest.mark.asyncio
    @respx.mock
    async def test_search_success(self):
        provider = SerpAPIProvider(api_key="test_key")

        mock_resp = {
            "images_results": [
                {
                    "original": "https://example.com/img1.jpg",
                    "title": "Image 1",
                    "link": "https://example.com/page1",
                    "original_width": 800,
                    "original_height": 600,
                },
                {
                    "original": "https://example.com/img2.jpg",
                    "title": "Image 2",
                    "link": "https://example.com/page2",
                    "original_width": 1024,
                    "original_height": 768,
                },
            ]
        }

        respx.get("https://serpapi.com/search").mock(
            return_value=httpx.Response(200, json=mock_resp)
        )

        results = await provider.search("Egon Schiele", limit=10)

        assert len(results) == 2
        assert results[0].image_url == "https://example.com/img1.jpg"
        assert results[0].title == "Image 1"
        assert results[0].page_url == "https://example.com/page1"
        assert results[0].width == 800
        assert results[0].height == 600

    @pytest.mark.asyncio
    @respx.mock
    async def test_search_dedup(self):
        provider = SerpAPIProvider(api_key="test_key")

        mock_resp = {
            "images_results": [
                {
                    "original": "https://example.com/img1.jpg",
                },
                {
                    "original": "https://example.com/img1.jpg",  # duplicate
                },
            ]
        }

        respx.get("https://serpapi.com/search").mock(
            return_value=httpx.Response(200, json=mock_resp)
        )

        results = await provider.search("Egon Schiele", limit=10)
        assert len(results) == 1

    @pytest.mark.asyncio
    @respx.mock
    async def test_search_http_error(self):
        provider = SerpAPIProvider(api_key="test_key")

        respx.get("https://serpapi.com/search").mock(
            return_value=httpx.Response(429)
        )

        results = await provider.search("Egon Schiele", limit=10)
        assert results == []
