from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ImageResult:
    image_url: str
    title: str | None
    page_url: str | None
    width: int | None
    height: int | None


class ImageSearchProvider(Protocol):
    async def search(self, query: str, limit: int) -> list[ImageResult]: ...
    
    async def spellcheck(self, query: str) -> str | None:
        return None
