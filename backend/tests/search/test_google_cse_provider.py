import httpx
import pytest
import respx

from src.search.providers.google import GoogleCSEProvider


class TestGoogleCSEProvider:
    @pytest.mark.asyncio
    @respx.mock
    async def test_search_success(self):
        provider = GoogleCSEProvider(api_key="test_key", cx="test_cx")

        mock_resp = {
            "items": [
                {
                    "link": "https://example.com/img1.jpg",
                    "title": "Image 1",
                    "image": {
                        "contextLink": "https://example.com/page1",
                        "width": 800,
                        "height": 600,
                    }
                },
                {
                    "link": "https://example.com/img2.jpg",
                    "title": "Image 2",
                    "image": {
                        "contextLink": "https://example.com/page2",
                        "width": 1024,
                        "height": 768,
                    }
                },
            ]
        }

        respx.get("https://www.googleapis.com/customsearch/v1").mock(
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
        provider = GoogleCSEProvider(api_key="test_key", cx="test_cx")

        mock_resp = {
            "items": [
                {
                    "link": "https://example.com/img1.jpg",
                },
                {
                    "link": "https://example.com/img1.jpg",  # duplicate
                },
            ]
        }

        respx.get("https://www.googleapis.com/customsearch/v1").mock(
            return_value=httpx.Response(200, json=mock_resp)
        )

        results = await provider.search("Egon Schiele", limit=10)
        assert len(results) == 1

    @pytest.mark.asyncio
    @respx.mock
    async def test_search_http_error(self):
        provider = GoogleCSEProvider(api_key="test_key", cx="test_cx")

        respx.get("https://www.googleapis.com/customsearch/v1").mock(
            return_value=httpx.Response(429)
        )

        results = await provider.search("Egon Schiele", limit=10)
        assert results == []
