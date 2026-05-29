import hashlib
import random

from src.search.base import ImageResult


class MockProvider:
    async def search(self, query: str, limit: int) -> list[ImageResult]:
        seed = int(hashlib.md5(query.encode()).hexdigest(), 16) & 0xFFFFFFFF
        rng = random.Random(seed)
        results = []
        for i in range(limit):
            mock_id = hashlib.sha256(f"{query}:{i}".encode()).hexdigest()[:12]
            results.append(
                ImageResult(
                    image_url=f"mock://{mock_id}/{i}.jpg",
                    title=f"{query} - obra {i + 1}",
                    page_url=None,
                    width=1200 + rng.randint(0, 600),
                    height=800 + rng.randint(0, 400),
                )
            )
        return results
