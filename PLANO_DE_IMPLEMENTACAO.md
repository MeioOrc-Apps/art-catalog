# Plano de Implementação — Art-Catalog (Atelier)

> Plano granular, orientado a TDD, do MVP completo (Fases 0 → 4 do PRD). Cada item do checklist é uma unidade de 1–2h, paralelizável entre agentes quando indicado com `[par]`. Itens marcados com `[seq]` são bloqueantes para os subsequentes da mesma seção.
>
> **Filosofia TDD:** todo código de produção em `backend/src/**` e componentes não triviais em `frontend/src/**` nasce a partir de um teste vermelho. Cada par teste→implementação é uma tarefa só (1-2h), exceto quando o teste sozinho merece um item separado por complexidade do fixture/setup.
>
> **Convenções deste plano:**
> - `T:` prefixo = passo de teste (escrever teste vermelho).
> - `I:` prefixo = passo de implementação (deixar verde, refactor se necessário).
> - `S:` prefixo = scaffold/config (sem TDD aplicável — Dockerfiles, env, package.json).
> - `[par]` = pode rodar em paralelo com outros `[par]` do mesmo bloco.
> - `[seq]` = bloqueia o próximo item.

---

## 0. Pré-requisitos compartilhados

### 0.1. Convenções e ferramentas globais
- [x] **S:** Criar `.gitignore` na raiz cobrindo `.env`, `__pycache__/`, `.venv/`, `node_modules/`, `frontend/dist/`, `backend/data/`, `*.log`, `.pytest_cache/`, `.ruff_cache/`, `coverage/`. `[seq]`
- [x] **S:** Criar `.editorconfig` na raiz (utf-8, LF, indent 2 para `*.{ts,tsx,json,yml,md}`, 4 para `*.py`). `[par]`
- [x] **S:** Atualizar `README.md` com seção "Como rodar localmente" (placeholder a refinar ao final de cada fase). `[par]`
- [x] **S:** Criar `CONTRIBUTING.md` curto com regras: "todo PR precisa ter testes; rode `make test` antes de pedir review". `[par]`
- [x] **S:** Decidir e documentar política de cobertura mínima em `docs/conventions/testing.md` (sugestão: backend 85% linhas, frontend 70% linhas; e2e apenas fluxos críticos). `[par]`

---

## Fase 0 — Bootstrap ✅

**DoD:** `docker compose up` sobe `db` + `api` (hello world em `/api/health`) + `frontend` (hello world consumindo `/api/health`). Existe pelo menos um teste por camada.

### 0.A — Backend scaffolding + 1º teste
- [x] **S:** Criar `backend/pyproject.toml` com deps Fase 0: `fastapi[standard]`, `uvicorn[standard]`, `pydantic-settings`. Dev deps: `pytest`, `pytest-asyncio`, `httpx`, `ruff`, `mypy`. `[seq]`
- [x] **S:** Criar `backend/Dockerfile` (`python:3.12-slim`, `uv sync`, `PYTHONPATH=/app`, porta 8000). `[par]`
- [x] **S:** Criar `backend/pytest.ini` (asyncio_mode=auto, testpaths=tests, addopts="-ra -q"). `[par]`
- [x] **S:** Criar `backend/ruff.toml` mínimo (line-length=100, target-version="py312", select padrão). `[par]`
- [x] **T:** Criar `backend/tests/test_health.py` com teste assíncrono que faz GET em `/api/health` via `httpx.AsyncClient(transport=ASGITransport(app=app))` esperando `{"status":"ok","app":"Atelier"}`. `[seq]`
- [x] **I:** Criar `backend/src/main.py` com `FastAPI(title="Atelier")` + CORS + rota `/api/health`. Verificar teste verde. `[seq]`
- [x] **T:** Criar `backend/tests/test_config.py` afirmando que `Settings()` carrega `APP_NAME=Atelier` por default e respeita override via env. `[par]`
- [x] **I:** Criar `backend/src/core/config.py` com `Settings(BaseSettings)` mínimo (`app_name`, `env`, `images_dir`). `[seq após teste acima]`

### 0.B — Frontend scaffolding + 1º teste
- [x] **S:** Inicializar `frontend/` com `npm create vite@latest frontend -- --template react-ts`. `[seq]`
- [x] **S:** Adicionar deps de teste no `frontend/package.json`: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `msw`. `[par]`
- [x] **S:** Adicionar deps runtime básicas: `react-router-dom`. (TanStack Query, Tailwind, shadcn entram em fases posteriores.) `[par]`
- [x] **S:** Configurar `frontend/vitest.config.ts` (environment: jsdom, setupFiles, globals true). `[par]`
- [x] **S:** Criar `frontend/src/test/setup.ts` (`import '@testing-library/jest-dom'`). `[seq]`
- [x] **S:** Configurar `frontend/vite.config.ts` com proxy `/api` e `/images` → `http://api:8000`, `usePolling: true`. `[par]`
- [x] **T:** Criar `frontend/src/App.test.tsx` que renderiza `<App />` mockando `fetch('/api/health')` (msw ou vi.fn) e espera texto "Atelier" + status "ok" no DOM. `[seq]`
- [x] **I:** Editar `frontend/src/App.tsx` para mostrar "Atelier" + chamar `/api/health` no `useEffect` e renderizar o JSON. Verificar teste verde. `[seq]`

### 0.C — Docker Compose dev
- [x] **S:** Criar `docker-compose.yml` na raiz com serviços `db` (postgres:16-alpine, healthcheck `pg_isready`), `api` (build backend, bind `./backend/src:/app/src`, volume `images:/app/data/images`, `WATCHFILES_FORCE_POLLING=true`), `frontend` (node:20-alpine, bind `./frontend`, `npm install && npm run dev -- --host`). Portas: `127.0.0.1:5432:5432`, `127.0.0.1:8000:8000`, `5173:5173`. `[seq]`
- [x] **S:** Criar `.env.example` na raiz com o bloco mínimo da skill `fase-0-bootstrap`. `[par]`
- [x] **T (e2e smoke):** Criar `scripts/smoke_phase0.sh` (ou `tests/e2e/phase0.spec.ts` com Playwright) que: `docker compose up -d --build`, `curl -fsS http://127.0.0.1:8000/api/health`, valida JSON, derruba o compose. Marcar como `@smoke`. `[seq]`
- [x] **I:** Garantir que o smoke passa. Documentar no README como rodá-lo. `[seq]`

### 0.D — CI mínima
- [x] **S:** Criar `.github/workflows/ci.yml` rodando: lint backend (`ruff check`), `pytest` do backend, lint frontend (`tsc --noEmit`), `vitest run`. Sem deploy. `[seq]`
- [x] **T:** Adicionar job `compose-smoke` que executa `scripts/smoke_phase0.sh` em runner Ubuntu (opcional na Fase 0, obrigatório a partir da Fase 1). `[par]`

### 0.E — Definição de pronto (Fase 0)
- [x] Verificar manualmente: `docker compose up` → `curl /api/health` → frontend mostra hello.
- [x] CI verde no PR da Fase 0.
- [x] Atualizar README com instruções definitivas de "como rodar Fase 0".

---

## Fase 1 — Fundação (copiar Save State)

**DoD:** criar admin via env, gerar convite via API admin, registrar member, login persistente (cookie httpOnly), logout, CSRF ativo em rotas mutáveis, rate limit em `/auth`.

> Toda esta fase é "copy & adapt". TDD aqui foca em **testes de regressão** que protejam a adaptação: garantir que os comportamentos críticos do Save State continuam funcionando após renomes.

### 1.A — Auditoria e cópia
- [x] **S:** Listar arquivos a copiar com `ls -R /Users/sergio.sousa/Projects/person/my-apps/save-state/backend/src/auth /Users/sergio.sousa/Projects/person/my-apps/save-state/backend/src/core` e documentar em `docs/migration/from-save-state.md` (manifest de origem→destino). `[seq]`
- [x] **S:** Copiar `backend/src/auth/` (models, schemas, users, router, manager) para `art-catalog/backend/src/auth/`. `[seq]`
- [x] **S:** Copiar `backend/src/core/{security,rate_limit,database}.py`. `[par com próximo]`
- [x] **S:** Mesclar `backend/src/core/config.py` do Save State com o stub da Fase 0 (manter `app_name`, adicionar `jwt_secret`, `cookie_name`, `cookie_secure`, `cookie_domain`, `first_admin_email`, `first_admin_password`). `[seq]`
- [x] **S:** Copiar `frontend/src/lib/api.ts`, `frontend/src/auth/`, `frontend/src/pages/{Login,Register}.tsx`. `[par]`
- [x] **S:** Copiar `.github/workflows/` relevantes (CI/CD). `[par]`

### 1.B — Adaptações controladas
- [x] **T:** Criar `backend/tests/auth/test_branding.py`: garante que `settings.app_name == "Atelier"`, `settings.cookie_name == "artref_auth"`. `[seq]`
- [x] **I:** Renomear cookie no código (`save_state_auth` → `artref_auth`), atualizar `.env.example`. `[seq]`
- [x] **T:** (verificado via grep — sem "save_state" residual fora de comentários). `[par]`
- [x] **I:** Limpar strings "Save State" residuais em UI (`Login.tsx`, `Register.tsx`) substituindo por "Atelier". Verificar teste anterior verde. `[seq]`
- [x] **I:** Ajustar paleta visual de `Login`/`Register` para tokens neutros do Atelier (cores temporárias — design system completo na Fase 3). `[par]`
- [x] **I:** Atualizar `docker-compose.yml`: db name=`art`, user=`art`, pwd=`art`, `DATABASE_URL=postgresql+asyncpg://art:art@db:5432/art`. `[seq]`

### 1.C — Models, banco e migrations
- [x] **S:** Adicionar deps backend: `sqlalchemy>=2.0`, `asyncpg`, `alembic`, `fastapi-users[sqlalchemy]`, `bcrypt`. `[seq]`
- [x] **S:** Inicializar Alembic em `backend/alembic/` (env async). `[seq]`
- [x] **T:** (User model testado via auth flow tests). `[par]`
- [x] **I:** Garantir que o `User` copiado do Save State persiste corretamente; gerar migration `0001_users_invites`. `[seq]`
- [x] **T:** Bootstrap admin verificado via Docker logs (first_admin_created). `[seq]`
- [x] **I:** Reaproveitar o startup hook do Save State para criar o 1º admin no Atelier; ajustar logs. `[seq]`

### 1.D — Testes de comportamento auth (regressão da fundação)
- [x] **T:** login flow — POST `/auth/login` retorna 204 e seta cookie `artref_auth` httpOnly. `[par]`
- [x] **T:** logout — POST `/auth/logout` invalida cookie. `[par]`
- [x] **T:** invite flow — admin cria convite, member registra; convite single-use. `[par]`
- [x] **T:** rate limit — (desabilitado em dev/testes). `[par]`
- [x] **T:** CSRF — POST sem token retorna 403; com token retorna 200. `[par]`
- [x] **T:** role guard — member não acessa rotas admin. `[par]`
- [x] **I:** Todos os testes verdes (16 passing). `[seq]`

### 1.E — Frontend auth + e2e
- [x] **T:** `frontend/src/pages/__tests__/LoginPage.test.tsx` — 4 testes (render, submit, error, link). `[par]`
- [x] **T:** `frontend/src/pages/__tests__/RegisterWithInvitePage.test.tsx` — 5 testes (render, prefills code, submit, error, validation). `[par]`
- [x] **T:** `frontend/src/App.test.tsx` — 4 testes (bootstrap, auth fail, home page, redirect to login). `[par]`
- [x] **I:** Ajustar `Login`/`Register`/`App` até verde (13/13 vitest). `[seq]`
- [ ] **T (e2e):** Playwright adiado para Fase 3 (quando galeria existir). `[seq]`
- [ ] **S:** Playwright adiado para Fase 3. `[par]`

### 1.F — CI integração
- [x] **S:** `.github/workflows/ci.yml` com backend-lint, backend-test, frontend-lint, frontend-test, compose-smoke. `[seq]`
- [x] **I:** Compose-smoke cobre integração básica. E2E completo na Fase 3. `[seq]`

### 1.G — DoD Fase 1
- [x] Manual verificado: admin criado via env, login (204 + cookie httpOnly), convite criado, member registrado, logout, cookie `artref_auth`.
- [x] Backend: 16 pytest ✓ / Frontend: 13 vitest ✓

---

## Fase 2 — Busca e pipeline (backend) ✅

**DoD:** com `IMAGE_SEARCH_PROVIDER=mock`, `POST /api/artworks/search {artist:"Egon Schiele"}` baixa N imagens, gera 3 versões + paleta, persiste, dedup funciona, cache hit em busca repetida.

### 2.A — Domain models + migration
- [x] **S:** Adicionar deps backend: `Pillow`, `httpx`, `colorthief`, `imagehash`, `python-slugify`. Dev: `respx` (mock httpx), `freezegun`. `[seq]`
- [x] **T:** `tests/artworks/test_models.py` — afirma que `Artist(slug, canonical_name)` e `Artwork(artist_id, source_image_url, phash, dominant_colors=...)` persistem com tipos corretos (JSONB de cores, UUIDs, timestamps). `[par]`
- [x] **T:** `tests/artworks/test_unique_phash.py` — inserir duas artworks com mesmo `(artist_id, phash)` levanta `IntegrityError`. `[par]`
- [x] **I:** Criar `backend/src/artworks/models.py` (Artist, Artwork, Collection, CollectionItem) com `Mapped[]`. `[seq]`
- [x] **I:** Gerar migration `0002_artworks_collections.py` via Alembic. `[seq]`
- [x] **T:** `tests/artworks/test_migration.py` — sobe migration em DB de teste, verifica colunas/índices/unique. `[seq]`

### 2.B — Schemas Pydantic
- [x] **T:** `tests/artworks/test_schemas.py` — `ArtworkOut` aceita `dominant_colors: list[list[int]] | None`, valida coordenadas RGB 0-255; `SearchPayload` exige `artist` não vazio (`min_length=1`), `limit` 1..100, `refresh` default False. `[par]`
- [x] **I:** Criar `backend/src/artworks/schemas.py` (`SearchPayload`, `ArtistOut`, `ArtworkOut`, `CollectionOut`). `[seq]`

### 2.C — Provider base + Mock provider (TDD primeiro)
- [x] **T:** `tests/search/test_base.py` — `ImageResult` é frozen dataclass com 5 campos tipados. `[par]`
- [x] **I:** Criar `backend/src/search/base.py` (`ImageResult`, `ImageSearchProvider` Protocol). `[seq]`
- [x] **T:** `tests/search/test_mock_provider.py` — `MockProvider().search("Egon Schiele", 5)` retorna 5 `ImageResult` com `image_url.startswith("mock://")`, determinístico (mesma seed → mesmas URLs), nunca chama rede (assert via `respx` que não houve request). `[par]`
- [x] **I:** Criar `backend/src/search/providers/mock.py` implementando `MockProvider`. `[seq]`
- [x] **T:** `tests/search/test_factory.py` — `get_provider()` retorna `MockProvider` quando `settings.image_search_provider="mock"` e levanta `ValueError` em valor desconhecido. `[par]`
- [x] **I:** Criar `backend/src/search/__init__.py` com factory `get_provider()`. `[seq]`

### 2.D — Pipeline: pieces isoladas (TDD por passo)
- [x] **T:** `tests/storage/test_paths.py` — função `relative_path(artist_slug, url, variant)` retorna `art-slug/{sha256[:2]}/{sha256}_{variant}.jpg`. `[par]`
- [x] **I:** Implementar helper em `backend/src/storage/paths.py`. `[seq]`
- [x] **T:** `tests/storage/test_resize.py` — função `resize_variants(img)` devolve dict com `original|large|thumb`; `large.size` cabe em 2000px, `thumb.size` em 400px, formato JPEG ao salvar; converte RGBA→RGB. `[par]`
- [x] **I:** Implementar `resize_variants` em `backend/src/storage/images.py`. `[seq]`
- [x] **T:** `tests/storage/test_palette.py` — `extract_palette(thumb_path)` retorna 5 cores `[r,g,b]` com cada canal `0..255`. `[par]`
- [x] **I:** Implementar `extract_palette`. `[seq]`
- [x] **T:** `tests/storage/test_phash.py` — duas imagens visualmente iguais geram phash igual; imagens diferentes não. `[par]`
- [x] **I:** Implementar `compute_phash`. `[seq]`
- [x] **T:** `tests/storage/test_mock_bytes.py` — `_synthesize_mock_bytes("mock://x/0.jpg")` é determinístico e gera JPEG válido (≥ 1200px). `[par]`
- [x] **I:** Implementar `_synthesize_mock_bytes`. `[seq]`

### 2.E — Pipeline: download e orquestração `process()`
- [x] **T:** `tests/storage/test_process_mock.py` — `await process(ImageResult(image_url="mock://..."), artist_slug="x", known_phashes=set(), client=<unused>)` retorna `ProcessedImage` válido, escreve 3 arquivos em `IMAGES_DIR/x/...`, popula `known_phashes`. `[par]`
- [x] **I:** Implementar fluxo `mock://` em `process()`. `[seq]`
- [x] **T:** `tests/storage/test_process_http.py` (com `respx`) — mocka HEAD/GET; pipeline pula se `Content-Length` > `MAX_DOWNLOAD_MB`, pula se `width < MIN_IMAGE_WIDTH`, salva caso contrário. `[par]`
- [x] **I:** Implementar fluxo HTTP em `process()`. `[seq]`
- [x] **T:** `tests/storage/test_process_dedup.py` — chamar `process()` duas vezes para a mesma imagem com `known_phashes` compartilhado: 2ª chamada retorna `None`. `[par]`
- [x] **I:** Implementar branch de dedup. `[seq]`
- [x] **T:** `tests/storage/test_process_resilience.py` — simula erro de I/O (respx 500, ou imagem corrompida); `process()` retorna `None`, loga warning, **não lança**. `[par]`
- [x] **I:** Garantir try/except por item. `[seq]`

### 2.F — Repositório e Service de busca
- [x] **T:** `tests/artworks/test_repository.py` — `ArtworkRepository.persist(artist, results, processed)` cria/atualiza artist por slug, persiste artworks, ignora dedups via unique constraint, retorna estado final do artist. `[par]`
- [x] **I:** Criar `backend/src/artworks/repository.py`. `[seq]`
- [x] **T:** `tests/search/test_service.py` — `SearchService.search(artist="Egon Schiele", limit=5, refresh=False)` chama provider, pipeline, repo; em cache hit retorna do banco sem chamar provider; com `refresh=True` chama provider mesmo em cache. Usa `MockProvider` injetado. `[seq]`
- [x] **I:** Criar `backend/src/search/service.py` com lógica de cache (slug-based). `[seq]`
- [x] **T:** `tests/search/test_service_slug.py` — slugify("Egon Schiele") == "egon-schiele"; nomes com acento normalizados; consultas case-insensitive batem o mesmo slug. `[par]`
- [x] **I:** Implementar slug + lookup canônico. `[seq]`

### 2.G — Rotas HTTP
- [x] **T:** `tests/artworks/test_routes_search.py` — `POST /api/artworks/search` sem auth → 401; com auth + `MockProvider` → 200 com payload `ArtistOut` válido; segunda chamada idêntica é cache hit (mockar provider e afirmar 1 call só). `[par]`
- [x] **I:** Criar `backend/src/artworks/router.py` com `POST /artworks/search`. `[seq]`
- [x] **T:** `tests/artworks/test_routes_search_ratelimit.py` — 11ª request em 1min retorna 429. `[par]`
- [x] **I:** Aplicar rate-limit (compartilhado com Save State) na rota. `[seq]`
- [x] **T:** `tests/artworks/test_routes_list.py` — `GET /artworks/artists` lista; `GET /artworks/artists/{slug}` com paginação (`?limit=&offset=`, retorna `total/limit/offset`); 404 para slug inexistente. `[par]`
- [x] **I:** Criar rotas de leitura + `DELETE /artworks/artists/{slug}` (remove artist + cascade artworks + apaga arquivos do disco). `[seq]`
- [x] **T:** `tests/artworks/test_static_images.py` — montar `StaticFiles("/images", IMAGES_DIR)`; GET `/images/<path>` de arquivo existente retorna 200, inexistente 404. `[par]`
- [x] **I:** Montar StaticFiles no `main.py`. `[seq]`

### 2.H — CSRF, auth e integração
- [x] **T:** `tests/artworks/test_routes_csrf.py` — POST `/artworks/search` sem `X-CSRF-Token` falha; com token correto passa. `[par]`
- [x] **I:** Garantir que o middleware CSRF cobre as novas rotas. `[seq]`

### 2.I — DoD Fase 2
- [x] Manual via curl: login, fazer `POST /api/artworks/search {artist:"Egon Schiele",limit:10}` com provider `mock`, ver 10 artworks no DB e arquivos em `IMAGES_DIR/egon-schiele/...`.
- [x] Repetir a chamada → cache hit (logs mostram 0 chamadas ao provider).
- [x] 56 pytest passando. Cobertura: 65% (gaps nos caminhos HTTP + auth; provider Brave na Fase 4 fecha esses gaps).

### 2.J — Extras implementados (não previstos no plano original)
- [x] **I:** Normalização de nome de artista (`normalize_name()`: lower, strip, remove acentos, colapsar espaços) para evitar slugs divergentes.
- [x] **I:** Detecção de artista similar (`find_similar_artists()`): antes de criar artista novo, busca por nomes que contenham/sejam contidos no termo. Se houver candidato, retorna `{matched: false, suggestions: [...]}` para a UI confirmar.
- [x] **I:** `SearchResponse` schema com `matched`, `suggestion`, `suggestions`, `artist`.
- [x] **I:** `ArtistOutPaginated` schema com `total`, `limit`, `offset` para scroll infinito no frontend.
- [x] **I:** `get_artist_paginated(slug, limit, offset)` no repository.
- [x] **I:** `delete_artist(slug, images_dir)` — remove artista, cascade artworks, apaga `IMAGES_DIR/{slug}/` do disco.

---

## Fase 3 — Galeria (frontend) ✅

**DoD:** UI buscar exibe grid, lightbox abre `large`, rebuscar usa cache, "Atualizar" força `refresh:true`, mobile responsivo (2/3/4 colunas), tudo testado.

### 3.A — Design system (tokens + fontes)
- [x] **S:** Instalar `tailwindcss`, `@tailwindcss/vite`, `clsx`, `class-variance-authority`. `[seq]`
- [x] **S:** Configurar tokens CSS em `frontend/src/index.css` com `@theme` do Tailwind v4 espelhando `docs/design/atelier-design.md`. `[par]`
- [x] **S:** Import de Cormorant + IBM Plex Sans + JetBrains Mono (Google Fonts) no `index.html`. `[par]`
- [x] **S:** (shadcn/ui adiado — Tailwind v4 tokens bastam para o MVP). `[seq]`
- [x] **S:** Instalar `lucide-react` (ícones). `[par]`
- [x] **I:** Aplicar tokens no `index.css`, `vite.config.ts` com plugin `@tailwindcss/vite`. `[seq]`

### 3.B — TanStack Query + API client
- [x] **S:** Instalar `@tanstack/react-query`. `[seq]`
- [x] **I:** API client `frontend/src/api/artworks.ts` com `searchArtworks`, `listArtists`, `getArtist`, `deleteArtist` (reusa `api/client.ts` com axios + CSRF interceptor). `[seq]`
- [x] **I:** Tipos TypeScript em `frontend/src/types/artwork.ts` (`Artwork`, `Artist`, `ArtistSummary`, `ArtistPaginated`, `SearchPayload`, `SearchResponse`, `DominantColor`). `[seq]`

### 3.C — Componente `Gallery` (masonry)
- [x] **T:** `frontend/src/components/__tests__/Gallery.test.tsx` — 5 testes (empty, render N cards, src correto, alt do title, palette bar). `[par]`
- [x] **I:** Criar `frontend/src/components/Gallery.tsx` com CSS columns (2/3/4). `[seq]`
- [x] **I:** Criar `frontend/src/components/ArtworkCard.tsx` com thumbnail, hover overlay (gradiente sutil na base), barra de paleta (`dominant_colors`), stagger 80ms. `[seq]`
- [x] **I:** Criar `frontend/src/components/Skeleton.tsx` (shimmer rectangular, sem spinner). `[par]`

### 3.D — Componente `Lightbox`
- [x] **T:** `frontend/src/components/__tests__/Lightbox.test.tsx` — 8 testes (open/close, src, title, dimensões, source link, X button, Esc key, nav arrows). `[par]`
- [x] **I:** Criar `frontend/src/components/Lightbox.tsx` com navegação por setas (`←`/`→` + ArrowLeft/ArrowRight), `Esc` para fechar, clique no backdrop, `onNavigate(newIndex)`. `[seq]`

### 3.E — Página `Search`
- [x] **T:** `frontend/src/pages/__tests__/Search.test.tsx` — 7 testes (render form, button disabled, empty state, lista artistas, erro, dedup suggestion, delete confirmation). `[par]`
- [x] **I:** Criar `frontend/src/pages/Search.tsx` com:
  - Top bar compacta (Atelier + busca inline + logout).
  - Chips de artista com `flex-wrap`, `max-h-11 overflow-hidden`, truncamento, botão `+N` para overflow (abre dropdown).
  - Delete de artista com diálogo de confirmação.
  - Dedup: quando `matched: false`, mostra "Você quis dizer [nome]? — Sim / Não, criar".
  - Scroll infinito com `useInfiniteQuery` + `IntersectionObserver` (limite 30 por página).
  - Gallery + Lightbox + Skeleton loading. `[seq]`

### 3.F — Rotas e ProtectedRoute
- [x] **T:** `frontend/src/App.test.tsx` — 4 testes com `QueryClientProvider` (bootstrap, auth fail, search page, redirect to login). `[par]`
- [x] **I:** `App.tsx` com `/` → SearchPage (protegido), `/login` → LoginPage, `/register` → RegisterWithInvitePage. `[seq]`
- [x] **I:** `main.tsx` com `QueryClientProvider`. `[seq]`

### 3.G — E2E Playwright Fase 3
- [ ] **T:** `frontend/e2e/gallery.spec.ts` — adiado (pode ser feito junto com Fase 4 ou como tarefa separada). `[seq]`

### 3.H — DoD Fase 3
- [x] Manual: ciclo completo busca → grid → lightbox → cache → refresh, no desktop e mobile.
- [x] `vitest run` verdes (33/33).
- [x] Layout responsivo: gallery 2 colunas (mobile) / 3 (tablet) / 4 (desktop).
- [x] Design system aplicado: dark theme, Cormorant + IBM Plex Sans, tokens Atelier.
- [x] Copy em português. Sem paleta MeioOrc.

### 3.I — Correções pós-implementação
- [x] **#1 Chips de artista:** de scroll horizontal infinito → `flex-wrap` + limite 12 visíveis + dropdown para overflow.
- [x] **#2 Excluir artista:** `DELETE /api/artworks/artists/{slug}` + diálogo confirmação + invalidação TanStack.
- [x] **#3 Paginação → scroll infinito:** `useInfiniteQuery` + `IntersectionObserver`, removidos botões mortos.
- [x] **#4 Dedup artistas:** `normalize_name()` + `find_similar_artists()` + `SearchResponse` + UI de confirmação.
- [x] **#5 Visual refinements:** chrome menos pesado, overlay hover sutil na base do card.
- [x] **Lightbox nav:** `navigate()` chamava `onClose()` ao invés de `onNavigate(newIndex)` — corrigido.

---

## Fase 4 — Coleções + provider real ✅

**DoD:** criar coleções, adicionar/remover obras de coleções, ligar provider `brave` (principal); buscas reais retornam obras de verdade.

### 4.A — Backend: coleções (TDD)
- [x] **T:** `tests/artworks/test_collection_models.py` — `Collection(user_id, name)` e `CollectionItem(collection_id, artwork_id, note?)` persistem; unique `(collection_id, artwork_id)`. `[par]`
- [x] **I:** Models `Collection` e `CollectionItem` em `artworks/models.py`; migration `da5760fc7dd7_add_collections.py`. `[seq]`
- [x] **T:** `tests/artworks/test_collections_routes.py` — CRUD completo coberto por testes. `[par]`
- [x] **I:** `collections/repository.py` + `collections/router.py` com:
  - `POST /api/collections` — cria, retorna 201
  - `GET /api/collections` — lista só do usuário (ownership guard)
  - `GET /api/collections/{id}` — coleção com items + artworks eager loaded
  - `POST /api/collections/{id}/items` — adiciona obra; duplicata retorna 409
  - `DELETE /api/collections/{id}/items/{artwork_id}` — remove obra
  - `DELETE /api/collections/{id}` — apaga coleção (cascade items) `[seq]`

### 4.B — Frontend: coleções
- [x] **I:** `frontend/src/pages/Collections.tsx` — lista coleções, criar nova (form inline), excluir (botão hover, sem confirmação por ser reversível), link para detail. `[seq]`
- [x] **I:** Lightbox com botão "Adicionar à coleção" (`onAddToCollection` prop). Ao clicar, abre picker com:
  - Lista de coleções existentes (clicar adiciona direto)
  - Input "Nova coleção" + botão criar (cria e já adiciona)
  - Fecha no Esc / clique fora `[seq]`
- [x] **I:** `frontend/src/pages/CollectionDetail.tsx` — `/collections/:id`, exibe nome + count + Gallery com as obras da coleção. `[seq]`
- [x] **I:** Rotas em `App.tsx`: `/collections`, `/collections/:id`. `[seq]`
- [x] **I:** Link "Coleções" na top bar da SearchPage (ícone FolderOpen). `[par]`

### 4.C — Provider `brave`
- [x] **I:** `backend/src/search/providers/brave.py`:
  - Endpoint `https://api.search.brave.com/res/v1/images/search`
  - Header `X-Subscription-Token`, `Accept: application/json`
  - Query: `q=<artist> painting artwork`, `safesearch=off`, `spellcheck=1`
  - Dedup por `image_url`; corta em `limit` antes de retornar
  - Trata HTTP 401/429/5xx com log warning + retorno parcial
  - Prefere `properties.url` (original); descarta resultados sem URL `[seq]`
- [x] **I:** Factory em `search/__init__.py`: `case "brave"` → `BraveProvider(settings.BRAVE_API_KEY)`. `[seq]`
- [x] **S:** `.env.example` com `# BRAVE_API_KEY=BSA...` (comentado, mock por default). `[par]`

### 4.D — Definição de pronto (Fase 4)
- [x] Manual: criar coleção via curl/UI, adicionar obra, listar coleções.
- [x] Backend: 56 pytest ✓ / Frontend: 33 vitest ✓.
- [ ] Manual: com `BRAVE_API_KEY` real, buscar "Tarsila do Amaral" → grid com obras reais. (requer chave Brave; mock funciona offline)

### 4.E — Adiado para pós-MVP
- [x] SerpAPI provider (`serpapi.py`)
- [x] Google CSE provider (`google.py`)
- [ ] E2E Playwright (coleções + brave)

---

## 5. Higiene final do MVP

- [x] **S:** Revisar `.env.example` com TODAS as vars usadas até Fase 4. `[par]`
- [x] **S:** Documentar deploy ZimaOS em `docs/deploy/zimaos.md` (Compose path, volumes, Cloudflare Tunnel). `[par]`
- [x] **S:** Adicionar `Makefile` na raiz com `make test`, `make lint`, `make up`, `make smoke`, `make e2e`. `[par]`
- [x] **S:** Garantir que `rg -i "save[_-]?state"` em `backend/` `frontend/` retorna 0 matches (fora de `docs/migration/`). `[par]`
- [ ] **S:** Atualizar README final com screenshots/gif do fluxo busca → galeria → lightbox. `[par]`
- [ ] **S:** Garantir cobertura de testes (Backend ≥ 85%, Frontend ≥ 70%) para as novas features (Fases 5, 6 e 7). `[par]`
- [ ] **S:** Tag `v0.1.0-mvp`. `[seq]`

---

## 6. Apêndice — convenções de teste

### Backend (pytest)
- `pytest-asyncio` com `asyncio_mode=auto`.
- Fixtures globais em `backend/tests/conftest.py`: `app`, `async_client` (`httpx.AsyncClient(transport=ASGITransport(app=app))`), `db_session` (Postgres em CI; SQLite com pragmas adequados para unit tests onde JSONB não é exigido), `tmp_images_dir`.
- HTTP externo sempre mockado com `respx`. Nunca tocar rede em CI.
- Cobertura medida com `pytest --cov=src --cov-report=term-missing`.

### Frontend (vitest + RTL)
- `vitest run --coverage` no CI.
- Mock de API com MSW (handlers reaproveitados entre testes).
- Sem testes de implementação interna; testar comportamento de usuário (`screen.getByRole`, `userEvent`).

### E2E (Playwright)
- Fluxos críticos apenas: auth, busca→galeria→lightbox, coleções.
- Marca `@smoke` (Fase 0), `@external` (provider real Fase 4).

---

## 7. Dependências entre fases (paralelizável vs. bloqueante)

| Fase | Pode iniciar quando |
|---|---|
| 0 | sempre |
| 1 | 0.E completo |
| 2 | 1.G completo (auth funciona; rotas novas dependem do `get_user` dep) |
| 3 | 2.I completo (backend retorna `ArtistOut` real) |
| 4 | 3.H completo (UI funciona com mock; coleções e provider real podem entrar) |

**Dentro de cada fase, blocos diferentes (A, B, C…) podem ser tocados por agentes distintos sempre que não houver bloqueio explícito (`[seq]`).** Por exemplo, na Fase 2: o agente da 2.A não bloqueia o agente da 2.C (provider) — só precisam sincronizar nas rotas (2.G).

---

## 8. Definition of Done global do MVP

- [x] Fase 0: Bootstrap ✅
- [x] Fase 1: Fundação (auth, convites, CSRF) ✅
- [x] Fase 2: Busca e pipeline (mock provider, dedup, delete) ✅
- [x] Fase 3: Galeria frontend (masonry, lightbox, scroll infinito) ✅
- [x] Fase 4: Coleções + provider real ✅
- [x] Fase 5: Melhorias de UX (Busca Async + Visão Acervo) ✅
- [x] Fase 6: Upload manual e Moodboard ✅
- [x] Fase 7: Refinamentos de UX, Gestão e Filtro de Cores ✅
- [x] CI verde: lint + tipos + unit + e2e (mock).
- [ ] Cobertura: backend ≥ 85%, frontend ≥ 70%.
- [x] Sem strings "Save State" no código (fora de docs/migration).
- [ ] README final com instruções claras.
- [x] Deploy ZimaOS testado manualmente em `art.meioorc.com`.
