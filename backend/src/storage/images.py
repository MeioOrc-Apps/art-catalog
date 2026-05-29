import hashlib
import io
import logging
import random
from dataclasses import dataclass
from pathlib import Path

import httpx
import imagehash
from colorthief import ColorThief
from PIL import Image as PILImage

from src.core.config import settings
from src.search.base import ImageResult
from src.storage.paths import relative_path

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProcessedImage:
    image_original: str
    image_large: str
    image_thumb: str
    width: int
    height: int
    dominant_colors: list[list[int]]
    phash: str


def resize_variants(img: PILImage.Image) -> dict[str, io.BytesIO]:
    if img.mode in ("RGBA", "P", "CMYK"):
        img = img.convert("RGB")

    result = {}
    for variant, max_side, quality in [
        ("original", None, 95),
        ("large", 2000, 90),
        ("thumb", 400, 80),
    ]:
        out = img.copy()
        if max_side is not None:
            out.thumbnail((max_side, max_side), PILImage.Resampling.LANCZOS)
        buf = io.BytesIO()
        out.save(buf, "JPEG", quality=quality, optimize=True)
        buf.seek(0)
        result[variant] = buf

    return result


def _synthesize_mock_bytes(mock_url: str) -> bytes:
    seed = hash(mock_url) & 0xFFFFFFFF
    rng = random.Random(seed)
    w = 1200 + rng.randint(0, 100)
    h = 900 + rng.randint(0, 100)
    color = (rng.randint(20, 220), rng.randint(20, 220), rng.randint(20, 220))
    img = PILImage.new("RGB", (w, h), color)
    # Overlay random rectangles to make phash unique per URL
    draw = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(img)
    for _ in range(rng.randint(3, 10)):
        x1 = rng.randint(0, w // 2)
        y1 = rng.randint(0, h // 2)
        x2 = rng.randint(w // 2, w)
        y2 = rng.randint(h // 2, h)
        rect_color = (rng.randint(20, 220), rng.randint(20, 220), rng.randint(20, 220))
        draw.rectangle([x1, y1, x2, y2], fill=rect_color)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


async def process_raw_image(
    data: bytes,
    *,
    artist_slug: str,
    known_phashes: set[str],
    source_url: str,
) -> ProcessedImage | None:
    try:
        img = PILImage.open(io.BytesIO(data))
        if img.width < settings.min_image_width:
            logger.info(
                "skip (thumbnail): %s (%dx%d)",
                source_url, img.width, img.height,
            )
            return None
        img = img.convert("RGB")

        phash = str(imagehash.phash(img))
        if phash in known_phashes:
            logger.info("skip (dedup phash): %s", source_url)
            return None

        url_hash = hashlib.sha256(source_url.encode()).hexdigest()
        variants = resize_variants(img)

        abs_dir = Path(settings.images_dir) / artist_slug / url_hash[:2]
        abs_dir.mkdir(parents=True, exist_ok=True)

        paths: dict[str, str] = {}
        for variant, buf in variants.items():
            rel = relative_path(artist_slug, source_url, variant)
            abs_path = Path(settings.images_dir) / rel
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            abs_path.write_bytes(buf.getvalue())
            paths[variant] = rel

        thumb_abs = Path(settings.images_dir) / paths["thumb"]
        colors = ColorThief(str(thumb_abs)).get_palette(color_count=5, quality=10)

        known_phashes.add(phash)
        return ProcessedImage(
            image_original=paths["original"],
            image_large=paths["large"],
            image_thumb=paths["thumb"],
            width=img.width,
            height=img.height,
            dominant_colors=[list(c) for c in colors],
            phash=phash,
        )
    except Exception as exc:
        logger.warning("failed processing %s: %s", source_url, exc)
        return None


async def process(
    result: ImageResult,
    *,
    artist_slug: str,
    known_phashes: set[str],
    client: httpx.AsyncClient,
) -> ProcessedImage | None:
    try:
        if result.image_url.startswith("mock://"):
            data = _synthesize_mock_bytes(result.image_url)
        else:
            head = await client.head(result.image_url)
            cl = int(head.headers.get("Content-Length", 0))
            if cl and cl > settings.max_download_mb * 1024 * 1024:
                logger.info("skip (too big): %s", result.image_url)
                return None
            r = await client.get(result.image_url)
            r.raise_for_status()
            data = r.content

        return await process_raw_image(
            data,
            artist_slug=artist_slug,
            known_phashes=known_phashes,
            source_url=result.image_url,
        )
    except Exception as exc:
        logger.warning("failed downloading %s: %s", result.image_url, exc)
        return None
