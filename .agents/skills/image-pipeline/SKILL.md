---
name: image-pipeline
description: Implementa o pipeline de download, processamento, paleta e deduplicação de imagens do Art-Catalog (HEAD check, GET streaming, Pillow 3 versões, colorthief, phash, dedup por artista). Use ao trabalhar em backend/src/storage/images.py, na rota POST /artworks/search, ou ao depurar falhas de download e processamento de imagens.
---

# Image Pipeline

Pipeline síncrono no MVP: o `POST /artworks/search` espera o processamento terminar. Falha em **uma** imagem **nunca** derruba o lote.

## Os 7 passos (ordem rígida)

Para cada `ImageResult` retornado pelo provider:

```
1. HEAD     → checar Content-Length; se > MAX_DOWNLOAD_MB, pular
2. GET      → streaming (httpx, follow_redirects=True)
3. PIL.open → descartar se width < MIN_IMAGE_WIDTH (corta thumbnails de blog)
4. RESIZE   → original (q=95), large (lado_maior=2000, q=90), thumb (lado_maior=400, q=80) - tudo JPEG
5. PALETTE  → colorthief sobre o thumb, 5 cores → list[[r,g,b], ...]
6. PHASH    → imagehash.phash; dedup: se phash já existe para o artista, descartar
7. SAVE     → IMAGES_DIR/{artist_slug}/{sha256(url)[:2]}/{sha256(url)}_{variant}.jpg
```

## Esqueleto

```python
# backend/src/storage/images.py
from __future__ import annotations
import hashlib, io, logging
from dataclasses import dataclass
from pathlib import Path

import httpx, imagehash
from PIL import Image
from colorthief import ColorThief

from src.core.config import settings
from src.search.base import ImageResult

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class ProcessedImage:
    image_original: str   # relativo a IMAGES_DIR
    image_large: str
    image_thumb: str
    width: int
    height: int
    dominant_colors: list[list[int]]
    phash: str

async def process(
    result: ImageResult, *, artist_slug: str, known_phashes: set[str],
    client: httpx.AsyncClient,
) -> ProcessedImage | None:
    try:
        if result.image_url.startswith("mock://"):
            data = _synthesize_mock_bytes(result.image_url)
        else:
            head = await client.head(result.image_url)
            cl = int(head.headers.get("Content-Length", 0))
            if cl and cl > settings.max_download_mb * 1024 * 1024:
                logger.info("pular (grande demais): %s", result.image_url); return None
            r = await client.get(result.image_url)
            r.raise_for_status()
            data = r.content

        img = Image.open(io.BytesIO(data))
        if img.width < settings.min_image_width:
            logger.info("pular (thumbnail): %s (%dx%d)", result.image_url, img.width, img.height)
            return None
        img = img.convert("RGB")

        phash = str(imagehash.phash(img))
        if phash in known_phashes:
            logger.info("pular (dedup phash): %s", result.image_url); return None

        url_hash = hashlib.sha256(result.image_url.encode()).hexdigest()
        rel_dir = Path(artist_slug) / url_hash[:2]
        abs_dir = Path(settings.images_dir) / rel_dir
        abs_dir.mkdir(parents=True, exist_ok=True)

        paths: dict[str, str] = {}
        for variant, max_side, q in [("original", None, 95), ("large", 2000, 90), ("thumb", 400, 80)]:
            out = img.copy()
            if max_side is not None:
                out.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
            rel = rel_dir / f"{url_hash}_{variant}.jpg"
            out.save(Path(settings.images_dir) / rel, "JPEG", quality=q, optimize=True)
            paths[variant] = str(rel)

        thumb_abs = Path(settings.images_dir) / paths["thumb"]
        colors = ColorThief(str(thumb_abs)).get_palette(color_count=5, quality=10)

        known_phashes.add(phash)
        return ProcessedImage(
            image_original=paths["original"], image_large=paths["large"], image_thumb=paths["thumb"],
            width=img.width, height=img.height,
            dominant_colors=[list(c) for c in colors], phash=phash,
        )
    except Exception as exc:
        logger.warning("falha processando %s: %s", result.image_url, exc)
        return None
```

## Regras de robustez (não-negociáveis)

- **Try/except por item.** O `except Exception` envolve o passo inteiro; um item ruim apenas vira `None` e o lote segue.
- **Stream para download grande** quando possível (`client.stream("GET", ...)`) — acima exemplifiquei o caminho simples; troque se `MAX_DOWNLOAD_MB` for relaxado.
- **Convert para RGB** sempre antes de salvar JPEG (algumas imagens chegam em RGBA/P/CMYK).
- **`Image.Resampling.LANCZOS`** é o resampling default; é o que dá qualidade no resize.
- **`phash` é assinatura de 64 bits** → suficiente para dedup dentro de um artista. Não usar md5 do conteúdo.
- **Caminhos no banco são relativos** a `IMAGES_DIR`. A API monta `StaticFiles(/images, IMAGES_DIR)` e o front consome `/images/{path}`.

## Mock — caminho offline

O provider `mock` devolve URLs `mock://...`. A pipeline detecta o esquema e gera bytes de uma imagem sintética com Pillow (gradient + ruído + tamanho 1200×900). Nunca chama `httpx` nesse ramo.

```python
def _synthesize_mock_bytes(mock_url: str) -> bytes:
    import random
    seed = hash(mock_url) & 0xFFFFFFFF
    rng = random.Random(seed)
    img = Image.new("RGB", (1200, 900),
                    (rng.randint(20, 220), rng.randint(20, 220), rng.randint(20, 220)))
    buf = io.BytesIO(); img.save(buf, "JPEG", quality=90); return buf.getvalue()
```

## Como integrar com `POST /artworks/search`

```python
provider = get_provider()
results = await provider.search(artist_name, limit=settings.default_results_per_search)

known_phashes = set(await repo.list_phashes_for_artist(artist.id))
processed: list[ProcessedImage] = []
async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
    for r in results:
        pi = await process(r, artist_slug=artist.slug, known_phashes=known_phashes, client=client)
        if pi: processed.append(pi)

await repo.persist_artworks(artist.id, results, processed)
```

## Checklist

```
- [ ] HEAD antes de GET; respeita MAX_DOWNLOAD_MB
- [ ] Descarta imagens com width < MIN_IMAGE_WIDTH
- [ ] Salva 3 versões em JPEG (original q=95, large 2000 q=90, thumb 400 q=80)
- [ ] Paleta de 5 cores via colorthief (sobre o thumb, não o original — mais rápido)
- [ ] phash; dedup por (artist_id, phash)
- [ ] Caminhos relativos a IMAGES_DIR
- [ ] Try/except por item; log + continua o lote
- [ ] Suporte a esquema mock:// sem rede
- [ ] Unique constraint (artist_id, phash) no banco também (defesa em profundidade)
```
