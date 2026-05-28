---
name: image-search-provider
description: Implementa um novo ImageSearchProvider (mock, brave, serpapi, google) seguindo o contrato pluggável definido no PRD do Art-Catalog. Use ao adicionar/modificar um provider de busca de imagens em backend/src/search/providers/ ou ao trocar a seleção de provider via IMAGE_SEARCH_PROVIDER.
---

# Image Search Provider

Providers de busca de imagens implementam um único `Protocol`. A escolha em tempo de execução é feita pela env `IMAGE_SEARCH_PROVIDER`.

## Contrato

```python
# backend/src/search/base.py
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
```

Toda implementação **deve**:

1. Ser uma classe `class XxxProvider:` que implementa o `Protocol` (duck typing — não precisa herdar).
2. Receber suas chaves via construtor (injetadas a partir de `Settings`), nunca ler env diretamente dentro do método.
3. Usar `httpx.AsyncClient` com `timeout=10` e `follow_redirects=True`.
4. Variar o query string para melhorar recall — ver §3.
5. Nunca explodir o lote em caso de erro de rede: retornar a lista parcial e logar com `logger.warning`.
6. Retornar **no máximo `limit` resultados**, deduplicados por `image_url`.

## Providers a implementar

| Provider | Quando usar | Notas |
|---|---|---|
| `mock` | dev sem chave | gera imagem sintética local com Pillow (sem rede) |
| `brave` | **produção (principal)** | docs em `docs/providers/brave-image-search.md`. Skill: `brave-search-api` |
| `serpapi` | alternativa | SerpAPI Google Images; retorna `original` + dimensões |
| `google` | alternativa | Google CSE JSON (`searchType=image`), 100 q/dia grátis |

## 3. Variações de query

Para melhorar recall e qualidade, **cada provider real** roda 2-3 variações da query e mescla os resultados (dedup por `image_url`) antes de cortar em `limit`:

```python
def query_variants(artist: str) -> list[str]:
    return [
        f"{artist} painting artwork high resolution",
        f"{artist} obras de arte",
        f"{artist} artwork museum",
    ]
```

`mock` ignora variações (é determinístico por `query`).

## Esqueleto de implementação

```python
# backend/src/search/providers/brave.py
import httpx
from src.search.base import ImageResult

BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/images/search"

class BraveProvider:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def search(self, query: str, limit: int) -> list[ImageResult]:
        results: dict[str, ImageResult] = {}
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            for q in query_variants(query):
                if len(results) >= limit:
                    break
                try:
                    r = await client.get(
                        BRAVE_ENDPOINT,
                        params={"q": q, "count": min(50, limit), "safesearch": "off"},
                        headers={
                            "X-Subscription-Token": self._api_key,
                            "Accept": "application/json",
                        },
                    )
                    r.raise_for_status()
                    for item in r.json().get("results", []):
                        url = item.get("properties", {}).get("url")
                        if not url or url in results:
                            continue
                        results[url] = ImageResult(
                            image_url=url,
                            title=item.get("title"),
                            page_url=item.get("url"),
                            width=item.get("properties", {}).get("width"),
                            height=item.get("properties", {}).get("height"),
                        )
                except httpx.HTTPError as exc:
                    logger.warning("brave: query=%r falhou: %s", q, exc)
        return list(results.values())[:limit]
```

## Mock provider — requisitos especiais

- **100% offline.** Não fazer requisição de rede.
- Gerar `limit` imagens com Pillow (cores variadas, dimensões 1200×900) e devolver `image_url` como `mock://<artist_slug>/<idx>.jpg`.
- A **pipeline** (skill `image-pipeline`) detecta o esquema `mock://` e gera a imagem localmente, sem `httpx`.
- Útil para validar TUDO antes de qualquer chave de API.

## Factory

```python
# backend/src/search/__init__.py
from src.core.config import settings
from src.search.providers.mock import MockProvider
from src.search.providers.brave import BraveProvider
# ...

def get_provider() -> ImageSearchProvider:
    match settings.image_search_provider:
        case "mock":    return MockProvider()
        case "brave":   return BraveProvider(settings.brave_api_key)
        case "serpapi": return SerpapiProvider(settings.serpapi_key)
        case "google":  return GoogleProvider(settings.google_cse_key, settings.google_cse_cx)
        case other:     raise ValueError(f"provider desconhecido: {other}")
```

## Checklist por provider

```
- [ ] Implementa async def search(query, limit) -> list[ImageResult]
- [ ] Usa httpx.AsyncClient com timeout=10 e follow_redirects=True
- [ ] Recebe chaves via construtor (não lê env interno)
- [ ] Roda 2-3 variações de query e mescla (dedup por image_url)
- [ ] Erros de rede viram log + lista parcial (não exception)
- [ ] Adicionado ao match em get_provider()
- [ ] Variáveis correspondentes em .env.example
- [ ] Teste manual: search("Egon Schiele", 5) retorna ≥ 1 resultado
```
