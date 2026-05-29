import logging
from typing import Any

import httpx

from src.search.base import ImageResult, ImageSearchProvider

logger = logging.getLogger(__name__)

BASE_URL = "https://www.googleapis.com/customsearch/v1"


class GoogleCSEProvider(ImageSearchProvider):
    def __init__(self, api_key: str, cx: str):
        self._key = api_key
        self._cx = cx

    async def search(self, query: str, limit: int = 30) -> list[ImageResult]:
        items: list[ImageResult] = []
        seen_urls: set[str] = set()
        
        # Google CSE only returns up to 10 results per page, max 100 results total
        # We need to paginate to get up to `limit` results
        start = 1
        
        async with httpx.AsyncClient(timeout=15) as client:
            while len(items) < limit and start <= 91:
                params: dict[str, Any] = {
                    "key": self._key,
                    "cx": self._cx,
                    "q": f"{query} art",
                    "searchType": "image",
                    "num": min(10, limit - len(items) + 5),  # fetch a bit more for dedup
                    "start": start,
                }

                try:
                    resp = await client.get(BASE_URL, params=params)
                    resp.raise_for_status()
                    data = resp.json()
                except httpx.HTTPStatusError as e:
                    logger.warning("google cse http %d: %s", e.response.status_code, e)
                    break
                except Exception as e:
                    logger.warning("google cse request failed: %s", e)
                    break

                results = data.get("items", [])
                if not results:
                    break

                for r in results:
                    image_url = r.get("link")
                    if not image_url:
                        continue
                    if image_url in seen_urls:
                        continue
                    seen_urls.add(image_url)

                    image_info = r.get("image", {})
                    
                    items.append(
                        ImageResult(
                            image_url=image_url,
                            title=r.get("title", f"{query} - result"),
                            page_url=r.get("image", {}).get("contextLink"),
                            width=image_info.get("width"),
                            height=image_info.get("height"),
                        )
                    )
                    if len(items) >= limit:
                        break
                
                start += 10

        logger.info("google cse returned %d results for %s (limit=%d)", len(items), query, limit)
        return items
