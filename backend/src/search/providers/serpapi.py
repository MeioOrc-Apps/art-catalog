import logging
from typing import Any

import httpx

from src.search.base import ImageResult, ImageSearchProvider

logger = logging.getLogger(__name__)

BASE_URL = "https://serpapi.com/search"


class SerpAPIProvider(ImageSearchProvider):
    def __init__(self, api_key: str):
        self._key = api_key

    async def search(self, query: str, limit: int = 30) -> list[ImageResult]:
        params: dict[str, Any] = {
            "engine": "google_images",
            "q": f"{query} art",
            "api_key": self._key,
            "num": min(limit * 2, 100),
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(BASE_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.warning("serpapi http %d: %s", e.response.status_code, e)
            return []
        except Exception as e:
            logger.warning("serpapi request failed: %s", e)
            return []

        results = data.get("images_results", [])
        items: list[ImageResult] = []
        seen_urls: set[str] = set()

        for r in results:
            image_url = r.get("original")
            if not image_url:
                continue
            if image_url in seen_urls:
                continue
            seen_urls.add(image_url)

            items.append(
                ImageResult(
                    image_url=image_url,
                    title=r.get("title", f"{query} - result"),
                    page_url=r.get("link"),
                    width=r.get("original_width"),
                    height=r.get("original_height"),
                )
            )
            if len(items) >= limit:
                break

        logger.info("serpapi returned %d results for %s (limit=%d)", len(items), query, limit)
        return items
