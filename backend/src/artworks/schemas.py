import re
import unicodedata
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


def normalize_name(name: str) -> str:
    n = unicodedata.normalize("NFKD", name)
    n = n.encode("ascii", "ignore").decode("ascii")
    n = n.lower().strip()
    n = re.sub(r"\s+", " ", n)
    return n


class ArtistCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=512)

class SearchPayload(BaseModel):
    artist: str = Field(min_length=1, max_length=512)
    limit: int = Field(default=30, ge=1, le=100)
    refresh: bool = False


class ArtistSummary(BaseModel):
    id: UUID
    slug: str
    canonical_name: str
    last_searched_at: datetime | None = None
    sync_status: str = "ready"
    
    model_config = {"from_attributes": True}

class ArtworkOut(BaseModel):
    id: UUID
    source_image_url: str
    source_page_url: str | None = None
    title: str | None = None
    image_original: str | None = None
    image_large: str | None = None
    image_thumb: str | None = None
    width: int | None = None
    height: int | None = None
    dominant_colors: list[list[int]] | None = None
    phash: str | None = None
    is_downloaded: bool = False
    is_pinned: bool = False
    created_at: datetime
    artist: ArtistSummary | None = None

    model_config = {"from_attributes": True}


class ArtistOut(BaseModel):
    id: UUID
    slug: str
    canonical_name: str
    bio_short: str | None = None
    last_searched_at: datetime | None = None
    sync_status: str = "ready"
    created_at: datetime
    artworks: list[ArtworkOut] = []

    model_config = {"from_attributes": True}


class ArtistOutPaginated(BaseModel):
    id: UUID
    slug: str
    canonical_name: str
    bio_short: str | None = None
    last_searched_at: datetime | None = None
    sync_status: str = "ready"
    created_at: datetime
    artworks: list[ArtworkOut] = []
    total: int = 0
    limit: int = 30
    offset: int = 0

    model_config = {"from_attributes": True}


class ExploreOutPaginated(BaseModel):
    artworks: list[ArtworkOut] = []
    total: int = 0
    limit: int = 50
    offset: int = 0


class SearchResponse(BaseModel):
    matched: bool = True
    suggestion: str | None = None
    suggestions: list[str] = []
    artist: ArtistOut | None = None


class CollectionCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=512)


class CollectionItemAddPayload(BaseModel):
    artwork_id: UUID
    note: str | None = None


class CollectionItemOut(BaseModel):
    id: UUID
    artwork_id: UUID
    note: str | None = None
    x: float
    y: float
    width: float | None = None
    height: float | None = None
    z_index: int
    created_at: datetime
    artwork: ArtworkOut | None = None

    model_config = {"from_attributes": True}

class CollectionItemUpdatePayload(BaseModel):
    note: str | None = None
    x: float | None = None
    y: float | None = None
    width: float | None = None
    height: float | None = None
    z_index: int | None = None


class CollectionOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    created_at: datetime
    items: list[CollectionItemOut] = []

    model_config = {"from_attributes": True}
