import logging
from typing import Any

import httpx

from src.search.base import ImageResult, ImageSearchProvider

logger = logging.getLogger(__name__)

BASE_URL = "https://duckduckgo.com/images.js"


class DuckDuckGoProvider(ImageSearchProvider):
    def __init__(self):
        pass

    async def _get_vqd(self, query: str, client: httpx.AsyncClient) -> str | None:
        try:
            resp = await client.get(
                "https://duckduckgo.com/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            resp.raise_for_status()
            
            # Extract vqd token from HTML
            text = resp.text
            vqd_start = text.find('vqd="')
            if vqd_start == -1:
                return None
                
            vqd_start += 5
            vqd_end = text.find('"', vqd_start)
            if vqd_end == -1:
                return None
                
            return text[vqd_start:vqd_end]
        except Exception as e:
            logger.warning("ddg vqd extraction failed: %s", e)
            return None

    async def search(self, query: str, limit: int = 30) -> list[ImageResult]:
        items: list[ImageResult] = []
        seen_urls: set[str] = set()
        
        search_query = f"{query} art"
        
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            vqd = await self._get_vqd(search_query, client)
            if not vqd:
                logger.warning("ddg failed to get vqd token")
                return []

            params: dict[str, Any] = {
                "q": search_query,
                "o": "json",
                "vqd": vqd,
                "f": ",,,",  # no filters
                "p": "1",
            }
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Referer": "https://duckduckgo.com/",
            }

            try:
                resp = await client.get(BASE_URL, params=params, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as e:
                logger.warning("ddg http %d: %s", e.response.status_code, e)
                return []
            except Exception as e:
                logger.warning("ddg request failed: %s", e)
                return []

            results = data.get("results", [])
            
            for r in results:
                image_url = r.get("image")
                if not image_url:
                    continue
                if image_url in seen_urls:
                    continue
                seen_urls.add(image_url)

                items.append(
                    ImageResult(
                        image_url=image_url,
                        title=r.get("title", f"{query} - result"),
                        page_url=r.get("url"),
                        width=r.get("width"),
                        height=r.get("height"),
                    )
                )
                if len(items) >= limit:
                    break

        logger.info("ddg returned %d results for %s (limit=%d)", len(items), query, limit)
        return items
