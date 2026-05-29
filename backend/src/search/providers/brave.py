import logging
from typing import Any

import httpx

from src.search.base import ImageResult, ImageSearchProvider

logger = logging.getLogger(__name__)

BASE_URL = "https://api.search.brave.com/res/v1/images/search"


class BraveProvider(ImageSearchProvider):
    def __init__(self, api_key: str):
        self._key = api_key

    async def spellcheck(self, query: str) -> str | None:
        headers = {
            "X-Subscription-Token": self._key,
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    BASE_URL,
                    params={"q": query, "spellcheck": 1},
                    headers=headers
                )
                resp.raise_for_status()
                data = resp.json()
                
                q_obj = data.get("query", {})
                if q_obj.get("altered"):
                    altered = q_obj["altered"]
                    if altered.lower() != query.lower():
                        return altered.title()
        except Exception as e:
            logger.warning("brave spellcheck failed: %s", e)
        return None

    async def search(self, query: str, limit: int = 30) -> list[ImageResult]:
        params: dict[str, Any] = {
            "q": query if ("art" in query.lower()) else f"{query} +artstation",
            "count": min(limit * 2, 100),
            "safesearch": "off",
            "spellcheck": 1,
            "size": "Large",
        }
        headers = {
            "X-Subscription-Token": self._key,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(BASE_URL, params=params, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.warning("brave http %d: %s", e.response.status_code, e)
            return []
        except Exception as e:
            logger.warning("brave request failed: %s", e)
            return []

        results = data.get("results", [])
        items: list[ImageResult] = []
        seen_urls: set[str] = set()
        
        query_words = [w.lower() for w in query.split()]

        for r in results:
            props = r.get("properties", {})
            image_url = props.get("url")
            if not image_url:
                continue
            if image_url in seen_urls:
                continue
                
            # Strictness filter: require all words from the query to be present in title or URL
            text_to_search = f"{r.get('title', '')} {image_url} {r.get('url', '')}".lower()
            if not all(w in text_to_search for w in query_words):
                continue
                
            seen_urls.add(image_url)

            items.append(
                ImageResult(
                    image_url=image_url,
                    title=r.get("title", f"{query} - result"),
                    page_url=r.get("url"),
                    width=props.get("width"),
                    height=props.get("height"),
                )
            )
            if len(items) >= limit:
                break

        logger.info("brave returned %d results for %s (limit=%d)", len(items), query, limit)
        return items
