# Backend — convenções

**Aplica-se a:** `backend/**`

## Estrutura
```
backend/src/
  core/      config (pydantic-settings), database (async engine + Base), security (CSRF, rate limit)
  auth/      copiado do Save State (models, schemas, users, router)
  artworks/  models, schemas, router  (domínio de arte)
  search/    base (interface + ImageResult), providers (mock/serpapi/google), service (orquestra)
  storage/   images (download → resize → paleta → phash)
  main.py    monta middlewares, rotas, StaticFiles em /images, cria 1º admin no startup
```

## Regras
- SQLAlchemy 2.0 com `Mapped[]` / `mapped_column`. Sessão async via dependency.
- Em produção, migrations com Alembic. Em dev pode usar `create_all` no startup.
- Pipeline de imagens: `HEAD` → `GET` streaming → Pillow → 3 versões (original/large/thumb)
  → colorthief (5 cores) → imagehash (phash). Dedup por `(artist_id, phash)`.
- `MIN_IMAGE_WIDTH` descarta thumbnails; `MAX_DOWNLOAD_MB` corta arquivos grandes.
- Provider `mock` gera imagem sintética local (Pillow) — deve funcionar 100% offline, sem rede.
- `POST /artworks/search`: cache por `slug`; só rebate na API externa em cache miss ou `refresh=true`.
- Toda rota de domínio exige usuário autenticado; convites/admin exigem role `admin`.
- Erros de processamento de imagem individual: try/except por item, log, e continua o lote.

## Modelo de dados
Ver PRD seção 6 (`artists`, `artworks`, `collections`, `collection_items`). Caminhos de imagem
são **relativos** a `IMAGES_DIR`; o banco guarda só o path relativo.
