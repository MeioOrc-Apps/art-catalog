---
name: brave-search-api
description: Referência rápida para integrar a Brave Image Search API (endpoint, parâmetros, headers, formato de resposta, limites de quota) no provider `brave` do Art-Catalog. Use ao implementar ou depurar backend/src/search/providers/brave.py, configurar BRAVE_API_KEY, ou tratar respostas da Brave Search.
---

# Brave Search API — Referência operacional

Provider principal de produção do Art-Catalog. **Quota grátis: 2000 queries/mês**, setup simples (uma única chave). Documentação completa do projeto em `docs/providers/brave-image-search.md` e `docs/providers/brave-web-search.md`.

## Endpoint

```
GET https://api.search.brave.com/res/v1/images/search
```

## Autenticação

Header obrigatório em **toda** requisição:

```
X-Subscription-Token: <BRAVE_API_KEY>
Accept: application/json
```

A chave vem de `https://api-dashboard.search.brave.com` → guardar em `.env` como `BRAVE_API_KEY` (já mapeada para `settings.brave_api_key`).

## Parâmetros principais

| Param | Default | Notas |
|---|---|---|
| `q` | — | obrigatório; query de busca |
| `count` | 50 | máx **200** por request |
| `country` | `US` | use `ALL` para global; para arte brasileira pode valer testar `BR` |
| `search_lang` | `en` | `pt` para artistas BR; `en` para internacionais |
| `safesearch` | `strict` | usar **`off`** no Art-Catalog (obras de arte podem ter nudez) |
| `spellcheck` | `1` | manter ligado; ajuda em grafias de artistas |

## Exemplo cURL

```bash
curl "https://api.search.brave.com/res/v1/images/search?q=Egon+Schiele+painting&count=50&safesearch=off" \
  -H "X-Subscription-Token: $BRAVE_API_KEY" \
  -H "Accept: application/json"
```

## Formato da resposta (campos relevantes)

```json
{
  "type": "images",
  "query": { "original": "...", "altered": "..." },
  "results": [
    {
      "type": "image_result",
      "title": "Self-Portrait with Physalis",
      "url": "https://www.leopoldmuseum.org/...",
      "source": "leopoldmuseum.org",
      "thumbnail": { "src": "https://imgs.search.brave.com/.../500.jpg" },
      "properties": {
        "url": "https://www.leopoldmuseum.org/.../full.jpg",
        "placeholder": "https://imgs.search.brave.com/.../tiny.jpg",
        "width": 1600,
        "height": 2000
      }
    }
  ]
}
```

### Mapeamento para `ImageResult`

| `ImageResult` | JSON path |
|---|---|
| `image_url` | `properties.url` (preferir original; **não** `thumbnail.src`, que é proxy 500px da Brave) |
| `title` | `title` |
| `page_url` | `url` (página fonte) |
| `width` | `properties.width` (pode faltar) |
| `height` | `properties.height` (pode faltar) |

**Importante:** `properties.url` é a URL original do host fonte. Se vier ausente em algum item, descartar (a pipeline depende dela para baixar o original em boa resolução).

## Estratégia de uso no Art-Catalog

- Para cada artista buscado, rodar **2-3 variações** de query (ver skill `image-search-provider` §3) — soma de até ~150 resultados antes do dedup.
- Cortar em `limit=settings.default_results_per_search` (30 por default) **após** dedup por `image_url` e **antes** de chamar a pipeline.
- `safesearch=off` é essencial — sem isso, nu artístico clássico fica fora.
- Cachear agressivamente no Postgres por `artist.slug`; só rebater na Brave em cache miss ou `refresh=true`.

## Erros comuns

| Status | Causa | Ação |
|---|---|---|
| 401 | chave inválida/expirada | conferir `BRAVE_API_KEY` no `.env` |
| 422 | parâmetro inválido | logar request body; geralmente `count > 200` |
| 429 | rate limit (1 q/s no plano grátis) | backoff exponencial, no máx 3 tentativas |
| 5xx | falha do lado da Brave | retry uma vez, depois logar e seguir com lista parcial |

## Quota e custos

- **Free tier:** 2000 queries/mês, 1 query/segundo.
- **Free AI tier:** 1 q/s, 5k queries/mês (não relevante aqui).
- Cada **variação de query** conta como 1 query. Com 3 variações por artista, 2000 q/mês = ~666 artistas únicos por mês — folgado.

## Configuração no projeto

```dotenv
# .env
IMAGE_SEARCH_PROVIDER=brave
BRAVE_API_KEY=...        # cadastrar em api-dashboard.search.brave.com
```

```python
# backend/src/core/config.py
class Settings(BaseSettings):
    image_search_provider: Literal["mock", "brave", "serpapi", "google"] = "mock"
    brave_api_key: str = ""
```

```python
# backend/src/search/__init__.py
case "brave":
    if not settings.brave_api_key:
        raise RuntimeError("BRAVE_API_KEY ausente")
    return BraveProvider(settings.brave_api_key)
```

## Quando NÃO usar Brave

- Em **dev local** sem rede / sem chave → use `mock`.
- Em **testes automatizados** → use `mock` (determinístico, offline).
- Se a quota mensal estourar → fallback para `google` (Google CSE, 100 q/dia grátis) configurado em outro deploy.
