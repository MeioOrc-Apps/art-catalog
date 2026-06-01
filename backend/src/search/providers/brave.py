import logging
from typing import Any

import httpx

from src.search.base import ImageResult, ImageSearchProvider

logger = logging.getLogger(__name__)

BASE_URL = "https://api.search.brave.com/res/v1/images/search"

# Brave caps at 100 results per call; we use 50 as page size to leave room
# for filtering and give 2x margin per fetch.
_PAGE_SIZE = 50


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

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        q: str,
        count: int,
        offset: int,
    ) -> list[dict]:
        params: dict[str, Any] = {
            "q": q,
            "count": count,
            "offset": offset,
            "safesearch": "off",
            "spellcheck": 1,
            "size": "Large",
        }
        headers = {
            "X-Subscription-Token": self._key,
            "Accept": "application/json",
        }
        try:
            resp = await client.get(BASE_URL, params=params, headers=headers)
            resp.raise_for_status()
            return resp.json().get("results", [])
        except httpx.HTTPStatusError as e:
            logger.warning("brave http %d (offset=%d): %s", e.response.status_code, offset, e)
            return []
        except Exception as e:
            logger.warning("brave request failed (offset=%d): %s", offset, e)
            return []

    async def search(self, query: str, limit: int = 30, start_offset: int = 0) -> list[ImageResult]:
        q = query if ("art" in query.lower()) else f"{query} +artstation"
        query_words = [w.lower() for w in query.split()]

        items: list[ImageResult] = []
        seen_urls: set[str] = set()

        # Paginate through Brave results until we have enough or exhaust pages.
        # start_offset lets callers skip pages already seen (e.g. on refresh after
        # N images were already downloaded from the top results).
        offset = (start_offset // _PAGE_SIZE) * _PAGE_SIZE  # snap to page boundary
        max_offset = 450  # Brave typically supports up to 490

        async with httpx.AsyncClient(timeout=15) as client:
            while len(items) < limit and offset <= max_offset:
                still_needed = limit - len(items)
                count = min(still_needed * 2, 100)

                raw = await self._fetch_page(client, q, count, offset)
                if not raw:
                    break

                for r in raw:
                    props = r.get("properties", {})
                    image_url = props.get("url")
                    if not image_url or image_url in seen_urls:
                        continue

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

                # If Brave returned fewer results than requested, there are no
                # more pages to fetch.
                if len(raw) < count:
                    break

                offset += _PAGE_SIZE

        logger.info("brave returned %d results for %s (limit=%d)", len(items), query, limit)
        return items
