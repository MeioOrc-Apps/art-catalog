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
- [ ] **S:** Criar `.gitignore` na raiz cobrindo `.env`, `__pycache__/`, `.venv/`, `node_modules/`, `frontend/dist/`, `backend/data/`, `*.log`, `.pytest_cache/`, `.ruff_cache/`, `coverage/`. `[seq]`
- [ ] **S:** Criar `.editorconfig` na raiz (utf-8, LF, indent 2 para `*.{ts,tsx,json,yml,md}`, 4 para `*.py`). `[par]`
- [ ] **S:** Atualizar `README.md` com seção "Como rodar localmente" (placeholder a refinar ao final de cada fase). `[par]`
- [ ] **S:** Criar `CONTRIBUTING.md` curto com regras: "todo PR precisa ter testes; rode `make test` antes de pedir review". `[par]`
- [ ] **S:** Decidir e documentar política de cobertura mínima em `docs/conventions/testing.md` (sugestão: backend 85% linhas, frontend 70% linhas; e2e apenas fluxos críticos). `[par]`

---

## Fase 0 — Bootstrap

**DoD:** `docker compose up` sobe `db` + `api` (hello world em `/api/health`) + `frontend` (hello world consumindo `/api/health`). Existe pelo menos um teste por camada.

### 0.A — Backend scaffolding + 1º teste
- [ ] **S:** Criar `backend/pyproject.toml` com deps Fase 0: `fastapi[standard]`, `uvicorn[standard]`, `pydantic-settings`. Dev deps: `pytest`, `pytest-asyncio`, `httpx`, `ruff`, `mypy`. `[seq]`
- [ ] **S:** Criar `backend/Dockerfile` (`python:3.12-slim`, `uv sync`, `PYTHONPATH=/app`, porta 8000). `[par]`
- [ ] **S:** Criar `backend/pytest.ini` (asyncio_mode=auto, testpaths=tests, addopts="-ra -q"). `[par]`
- [ ] **S:** Criar `backend/ruff.toml` mínimo (line-length=100, target-version="py312", select padrão). `[par]`
- [ ] **T:** Criar `backend/tests/test_health.py` com teste assíncrono que faz GET em `/api/health` via `httpx.AsyncClient(transport=ASGITransport(app=app))` esperando `{"status":"ok","app":"Atelier"}`. `[seq]`
- [ ] **I:** Criar `backend/src/main.py` com `FastAPI(title="Atelier")` + CORS + rota `/api/health`. Verificar teste verde. `[seq]`
- [ ] **T:** Criar `backend/tests/test_config.py` afirmando que `Settings()` carrega `APP_NAME=Atelier` por default e respeita override via env. `[par]`
- [ ] **I:** Criar `backend/src/core/config.py` com `Settings(BaseSettings)` mínimo (`app_name`, `env`, `images_dir`). `[seq após teste acima]`

### 0.B — Frontend scaffolding + 1º teste
- [ ] **S:** Inicializar `frontend/` com `npm create vite@latest frontend -- --template react-ts`. `[seq]`
- [ ] **S:** Adicionar deps de teste no `frontend/package.json`: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `msw`. `[par]`
- [ ] **S:** Adicionar deps runtime básicas: `react-router-dom`. (TanStack Query, Tailwind, shadcn entram em fases posteriores.) `[par]`
- [ ] **S:** Configurar `frontend/vitest.config.ts` (environment: jsdom, setupFiles, globals true). `[par]`
- [ ] **S:** Criar `frontend/src/test/setup.ts` (`import '@testing-library/jest-dom'`). `[seq]`
- [ ] **S:** Configurar `frontend/vite.config.ts` com proxy `/api` e `/images` → `http://api:8000`, `usePolling: true`. `[par]`
- [ ] **T:** Criar `frontend/src/App.test.tsx` que renderiza `<App />` mockando `fetch('/api/health')` (msw ou vi.fn) e espera texto "Atelier" + status "ok" no DOM. `[seq]`
- [ ] **I:** Editar `frontend/src/App.tsx` para mostrar "Atelier" + chamar `/api/health` no `useEffect` e renderizar o JSON. Verificar teste verde. `[seq]`

### 0.C — Docker Compose dev
- [ ] **S:** Criar `docker-compose.yml` na raiz com serviços `db` (postgres:16-alpine, healthcheck `pg_isready`), `api` (build backend, bind `./backend/src:/app/src`, volume `images:/app/data/images`, `WATCHFILES_FORCE_POLLING=true`), `frontend` (node:20-alpine, bind `./frontend`, `npm install && npm run dev -- --host`). Portas: `127.0.0.1:5432:5432`, `127.0.0.1:8000:8000`, `5173:5173`. `[seq]`
- [ ] **S:** Criar `.env.example` na raiz com o bloco mínimo da skill `fase-0-bootstrap`. `[par]`
- [ ] **T (e2e smoke):** Criar `scripts/smoke_phase0.sh` (ou `tests/e2e/phase0.spec.ts` com Playwright) que: `docker compose up -d --build`, `curl -fsS http://127.0.0.1:8000/api/health`, valida JSON, derruba o compose. Marcar como `@smoke`. `[seq]`
- [ ] **I:** Garantir que o smoke passa. Documentar no README como rodá-lo. `[seq]`

### 0.D — CI mínima
- [ ] **S:** Criar `.github/workflows/ci.yml` rodando: lint backend (`ruff check`), `pytest` do backend, lint frontend (`tsc --noEmit`), `vitest run`. Sem deploy. `[seq]`
- [ ] **T:** Adicionar job `compose-smoke` que executa `scripts/smoke_phase0.sh` em runner Ubuntu (opcional na Fase 0, obrigatório a partir da Fase 1). `[par]`

### 0.E — Definição de pronto (Fase 0)
- [ ] Verificar manualmente: `docker compose up` → `curl /api/health` → frontend mostra hello.
- [ ] CI verde no PR da Fase 0.
- [ ] Atualizar README com instruções definitivas de "como rodar Fase 0".

---

## Fase 1 — Fundação (copiar Save State)

**DoD:** criar admin via env, gerar convite via API admin, registrar member, login persistente (cookie httpOnly), logout, CSRF ativo em rotas mutáveis, rate limit em `/auth`.

> Toda esta fase é "copy & adapt". TDD aqui foca em **testes de regressão** que protejam a adaptação: garantir que os comportamentos críticos do Save State continuam funcionando após renomes.

### 1.A — Auditoria e cópia
- [ ] **S:** Listar arquivos a copiar com `ls -R /Users/sergio.sousa/Projects/person/my-apps/save-state/backend/src/auth /Users/sergio.sousa/Projects/person/my-apps/save-state/backend/src/core` e documentar em `docs/migration/from-save-state.md` (manifest de origem→destino). `[seq]`
- [ ] **S:** Copiar `backend/src/auth/` (models, schemas, users, router, manager) para `art-catalog/backend/src/auth/`. `[seq]`
- [ ] **S:** Copiar `backend/src/core/{security,rate_limit,database}.py`. `[par com próximo]`
- [ ] **S:** Mesclar `backend/src/core/config.py` do Save State com o stub da Fase 0 (manter `app_name`, adicionar `jwt_secret`, `cookie_name`, `cookie_secure`, `cookie_domain`, `first_admin_email`, `first_admin_password`). `[seq]`
- [ ] **S:** Copiar `frontend/src/lib/api.ts`, `frontend/src/auth/`, `frontend/src/pages/{Login,Register}.tsx`. `[par]`
- [ ] **S:** Copiar `.github/workflows/` relevantes (CI/CD). `[par]`

### 1.B — Adaptações controladas
- [ ] **T:** Criar `backend/tests/auth/test_branding.py`: garante que `settings.app_name == "Atelier"`, `settings.cookie_name == "artref_auth"`. `[seq]`
- [ ] **I:** Renomear cookie no código (`save_state_auth` → `artref_auth`), atualizar `.env.example`. `[seq]`
- [ ] **T:** Criar `backend/tests/auth/test_no_save_state_leaks.py` que rodará `subprocess` de `rg -i "save[_-]?state"` sobre `backend/` e `frontend/` (excluindo `docs/migration/`) e falha se encontrar match. `[par]`
- [ ] **I:** Limpar strings "Save State" residuais em UI (`Login.tsx`, `Register.tsx`) substituindo por "Atelier". Verificar teste anterior verde. `[seq]`
- [ ] **I:** Ajustar paleta visual de `Login`/`Register` para tokens neutros do Atelier (cores temporárias — design system completo na Fase 3). `[par]`
- [ ] **I:** Atualizar `docker-compose.yml`: db name=`art`, user=`art`, pwd=`art`, `DATABASE_URL=postgresql+asyncpg://art:art@db:5432/art`. `[seq]`

### 1.C — Models, banco e migrations
- [ ] **S:** Adicionar deps backend: `sqlalchemy>=2.0`, `asyncpg`, `alembic`, `fastapi-users[sqlalchemy]`, `bcrypt`. `[seq]`
- [ ] **S:** Inicializar Alembic em `backend/alembic/` (env async). `[seq]`
- [ ] **T:** Criar `backend/tests/auth/test_user_model.py` com fixture de session async (em-memória SQLite ou Postgres em CI) afirmando criação de `User` com `role="member"` por default. `[par]`
- [ ] **I:** Garantir que o `User` copiado do Save State persiste corretamente; gerar migration `0001_users_invites`. `[seq]`
- [ ] **T:** Criar `backend/tests/auth/test_first_admin_bootstrap.py` afirmando que ao subir a app com `FIRST_ADMIN_EMAIL`/`FIRST_ADMIN_PASSWORD` definidos, um usuário com `is_superuser=True` e `role="admin"` é criado idempotentemente. `[seq]`
- [ ] **I:** Reaproveitar o startup hook do Save State para criar o 1º admin no Atelier; ajustar logs. `[seq]`

### 1.D — Testes de comportamento auth (regressão da fundação)
- [ ] **T:** `tests/auth/test_login_flow.py` — POST `/auth/login` com `application/x-www-form-urlencoded` retorna 204 e seta cookie `artref_auth` httpOnly. `[par]`
- [ ] **T:** `tests/auth/test_logout.py` — POST `/auth/logout` invalida cookie. `[par]`
- [ ] **T:** `tests/auth/test_invite_flow.py` — admin cria convite (`POST /auth/invites`), member usa convite (`POST /auth/register-with-invite`); convite só pode ser usado uma vez. `[par]`
- [ ] **T:** `tests/auth/test_rate_limit.py` — 6ª tentativa de login em 5 min recebe 429. `[par]`
- [ ] **T:** `tests/auth/test_csrf.py` — POST em rota mutável protegida sem header `X-CSRF-Token` retorna 403; com header e cookie correspondentes, retorna 200. `[par]`
- [ ] **T:** `tests/auth/test_role_guard.py` — member chamando rota admin recebe 403. `[par]`
- [ ] **I:** Para cada teste que falhar após a cópia, ajustar o módulo correspondente. Todos verdes ao final do bloco. `[seq]`

### 1.E — Frontend auth + e2e
- [ ] **T:** `frontend/src/auth/__tests__/AuthContext.test.tsx` — `AuthContext` faz GET `/auth/me` no mount e expõe `user`/`logout`. `[par]`
- [ ] **T:** `frontend/src/pages/__tests__/Login.test.tsx` — submete formulário em form-urlencoded com mock de fetch, redireciona em sucesso. `[par]`
- [ ] **T:** `frontend/src/pages/__tests__/Register.test.tsx` — valida campo de convite, exibe erro de convite inválido. `[par]`
- [ ] **I:** Ajustar `Login`/`Register`/`AuthContext` até verde. `[seq]`
- [ ] **T (e2e):** Criar `frontend/e2e/auth.spec.ts` (Playwright): admin loga, gera convite via UI/API, novo member registra, faz login, vê tela protegida, faz logout. `[seq]`
- [ ] **S:** Adicionar Playwright (`@playwright/test`) ao frontend, com `playwright.config.ts` apontando para `http://localhost:5173`. `[par]`
- [ ] **I:** Implementar telas necessárias para o e2e passar (já vindas do Save State; só ajustar).

### 1.F — CI integração
- [ ] **S:** Atualizar `.github/workflows/ci.yml` com job `e2e` que sobe compose, roda `npx playwright test`, derruba. `[seq]`
- [ ] **I:** Garantir pipeline verde. `[seq]`

### 1.G — DoD Fase 1
- [ ] Manual: criar admin via env, login, gerar convite, registrar member, logout, verificar cookie httpOnly no devtools.
- [ ] CI verde com unit + e2e.

---

## Fase 2 — Busca e pipeline (backend)

**DoD:** com `IMAGE_SEARCH_PROVIDER=mock`, `POST /api/artworks/search {artist:"Egon Schiele"}` baixa N imagens, gera 3 versões + paleta, persiste, dedup funciona, cache hit em busca repetida.

### 2.A — Domain models + migration
- [ ] **S:** Adicionar deps backend: `Pillow`, `httpx`, `colorthief`, `imagehash`, `python-slugify`. Dev: `respx` (mock httpx), `freezegun`. `[seq]`
- [ ] **T:** `tests/artworks/test_models.py` — afirma que `Artist(slug, canonical_name)` e `Artwork(artist_id, source_image_url, phash, dominant_colors=...)` persistem com tipos corretos (JSONB de cores, UUIDs, timestamps). `[par]`
- [ ] **T:** `tests/artworks/test_unique_phash.py` — inserir duas artworks com mesmo `(artist_id, phash)` levanta `IntegrityError`. `[par]`
- [ ] **I:** Criar `backend/src/artworks/models.py` (Artist, Artwork, Collection, CollectionItem) com `Mapped[]`. `[seq]`
- [ ] **I:** Gerar migration `0002_artworks_collections.py` via Alembic. `[seq]`
- [ ] **T:** `tests/artworks/test_migration.py` — sobe migration em DB de teste, verifica colunas/índices/unique. `[seq]`

### 2.B — Schemas Pydantic
- [ ] **T:** `tests/artworks/test_schemas.py` — `ArtworkOut` aceita `dominant_colors: list[list[int]] | None`, valida coordenadas RGB 0-255; `SearchPayload` exige `artist` não vazio (`min_length=1`), `limit` 1..100, `refresh` default False. `[par]`
- [ ] **I:** Criar `backend/src/artworks/schemas.py` (`SearchPayload`, `ArtistOut`, `ArtworkOut`, `CollectionOut`). `[seq]`

### 2.C — Provider base + Mock provider (TDD primeiro)
- [ ] **T:** `tests/search/test_base.py` — `ImageResult` é frozen dataclass com 5 campos tipados. `[par]`
- [ ] **I:** Criar `backend/src/search/base.py` (`ImageResult`, `ImageSearchProvider` Protocol). `[seq]`
- [ ] **T:** `tests/search/test_mock_provider.py` — `MockProvider().search("Egon Schiele", 5)` retorna 5 `ImageResult` com `image_url.startswith("mock://")`, determinístico (mesma seed → mesmas URLs), nunca chama rede (assert via `respx` que não houve request). `[par]`
- [ ] **I:** Criar `backend/src/search/providers/mock.py` implementando `MockProvider`. `[seq]`
- [ ] **T:** `tests/search/test_factory.py` — `get_provider()` retorna `MockProvider` quando `settings.image_search_provider="mock"` e levanta `ValueError` em valor desconhecido. `[par]`
- [ ] **I:** Criar `backend/src/search/__init__.py` com factory `get_provider()`. `[seq]`

### 2.D — Pipeline: pieces isoladas (TDD por passo)
- [ ] **T:** `tests/storage/test_paths.py` — função `relative_path(artist_slug, url, variant)` retorna `art-slug/{sha256[:2]}/{sha256}_{variant}.jpg`. `[par]`
- [ ] **I:** Implementar helper em `backend/src/storage/paths.py`. `[seq]`
- [ ] **T:** `tests/storage/test_resize.py` — função `resize_variants(img)` devolve dict com `original|large|thumb`; `large.size` cabe em 2000px, `thumb.size` em 400px, formato JPEG ao salvar; converte RGBA→RGB. `[par]`
- [ ] **I:** Implementar `resize_variants` em `backend/src/storage/images.py`. `[seq]`
- [ ] **T:** `tests/storage/test_palette.py` — `extract_palette(thumb_path)` retorna 5 cores `[r,g,b]` com cada canal `0..255`. `[par]`
- [ ] **I:** Implementar `extract_palette`. `[seq]`
- [ ] **T:** `tests/storage/test_phash.py` — duas imagens visualmente iguais geram phash igual; imagens diferentes não. `[par]`
- [ ] **I:** Implementar `compute_phash`. `[seq]`
- [ ] **T:** `tests/storage/test_mock_bytes.py` — `_synthesize_mock_bytes("mock://x/0.jpg")` é determinístico e gera JPEG válido (≥ 1200px). `[par]`
- [ ] **I:** Implementar `_synthesize_mock_bytes`. `[seq]`

### 2.E — Pipeline: download e orquestração `process()`
- [ ] **T:** `tests/storage/test_process_mock.py` — `await process(ImageResult(image_url="mock://..."), artist_slug="x", known_phashes=set(), client=<unused>)` retorna `ProcessedImage` válido, escreve 3 arquivos em `IMAGES_DIR/x/...`, popula `known_phashes`. `[par]`
- [ ] **I:** Implementar fluxo `mock://` em `process()`. `[seq]`
- [ ] **T:** `tests/storage/test_process_http.py` (com `respx`) — mocka HEAD/GET; pipeline pula se `Content-Length` > `MAX_DOWNLOAD_MB`, pula se `width < MIN_IMAGE_WIDTH`, salva caso contrário. `[par]`
- [ ] **I:** Implementar fluxo HTTP em `process()`. `[seq]`
- [ ] **T:** `tests/storage/test_process_dedup.py` — chamar `process()` duas vezes para a mesma imagem com `known_phashes` compartilhado: 2ª chamada retorna `None`. `[par]`
- [ ] **I:** Implementar branch de dedup. `[seq]`
- [ ] **T:** `tests/storage/test_process_resilience.py` — simula erro de I/O (respx 500, ou imagem corrompida); `process()` retorna `None`, loga warning, **não lança**. `[par]`
- [ ] **I:** Garantir try/except por item. `[seq]`

### 2.F — Repositório e Service de busca
- [ ] **T:** `tests/artworks/test_repository.py` — `ArtworkRepository.persist(artist, results, processed)` cria/atualiza artist por slug, persiste artworks, ignora dedups via unique constraint, retorna estado final do artist. `[par]`
- [ ] **I:** Criar `backend/src/artworks/repository.py`. `[seq]`
- [ ] **T:** `tests/search/test_service.py` — `SearchService.search(artist="Egon Schiele", limit=5, refresh=False)` chama provider, pipeline, repo; em cache hit retorna do banco sem chamar provider; com `refresh=True` chama provider mesmo em cache. Usa `MockProvider` injetado. `[seq]`
- [ ] **I:** Criar `backend/src/search/service.py` com lógica de cache (slug-based). `[seq]`
- [ ] **T:** `tests/search/test_service_slug.py` — slugify("Egon Schiele") == "egon-schiele"; nomes com acento normalizados; consultas case-insensitive batem o mesmo slug. `[par]`
- [ ] **I:** Implementar slug + lookup canônico. `[seq]`

### 2.G — Rotas HTTP
- [ ] **T:** `tests/artworks/test_routes_search.py` — `POST /api/artworks/search` sem auth → 401; com auth + `MockProvider` → 200 com payload `ArtistOut` válido; segunda chamada idêntica é cache hit (mockar provider e afirmar 1 call só). `[par]`
- [ ] **I:** Criar `backend/src/artworks/router.py` com `POST /artworks/search`. `[seq]`
- [ ] **T:** `tests/artworks/test_routes_search_ratelimit.py` — 11ª request em 1min retorna 429. `[par]`
- [ ] **I:** Aplicar rate-limit (compartilhado com Save State) na rota. `[seq]`
- [ ] **T:** `tests/artworks/test_routes_list.py` — `GET /artworks/artists` lista paginada; `GET /artworks/artists/{slug}` retorna artist+artworks; 404 para slug inexistente. `[par]`
- [ ] **I:** Criar rotas de leitura. `[seq]`
- [ ] **T:** `tests/artworks/test_static_images.py` — montar `StaticFiles("/images", IMAGES_DIR)`; GET `/images/<path>` de arquivo existente retorna 200, inexistente 404. `[par]`
- [ ] **I:** Montar StaticFiles no `main.py`. `[seq]`

### 2.H — CSRF, auth e integração
- [ ] **T:** `tests/artworks/test_routes_csrf.py` — POST `/artworks/search` sem `X-CSRF-Token` falha; com token correto passa. `[par]`
- [ ] **I:** Garantir que o middleware CSRF cobre as novas rotas. `[seq]`

### 2.I — DoD Fase 2
- [ ] Manual via curl: login, fazer `POST /api/artworks/search {artist:"Egon Schiele",limit:10}` com provider `mock`, ver 10 artworks no DB e arquivos em `IMAGES_DIR/egon-schiele/...`.
- [ ] Repetir a chamada → cache hit (logs mostram 0 chamadas ao provider).
- [ ] Cobertura backend ≥ 85% linhas (`pytest --cov`).

---

## Fase 3 — Galeria (frontend)

**DoD:** UI buscar exibe grid, lightbox abre `large`, rebuscar usa cache, "Atualizar" força `refresh:true`, mobile responsivo (2/3/4 colunas), tudo testado.

### 3.A — Design system (tokens + fontes)
- [ ] **S:** Instalar `tailwindcss`, `@tailwindcss/vite` (ou postcss), `clsx`, `class-variance-authority`. `[seq]`
- [ ] **S:** Configurar `frontend/tailwind.config.ts` com tokens de `docs/design/atelier-design.md` (`colors`, `fontFamily`). `[par]`
- [ ] **S:** Criar `frontend/src/index.css` com variáveis CSS (§2 do design doc), import de Cormorant + IBM Plex Sans (Google Fonts). `[par]`
- [ ] **S:** Instalar shadcn/ui com tema dark custom (sem verde/âmbar MeioOrc). `[seq]`
- [ ] **T:** `frontend/src/__tests__/tokens.test.ts` — afirma que CSS variables esperadas (`--bg`, `--fg`, etc.) estão definidas após mount inicial. `[par]`
- [ ] **I:** Ajustar tokens até verde. `[seq]`

### 3.B — TanStack Query + API client
- [ ] **S:** Instalar `@tanstack/react-query`. `[seq]`
- [ ] **T:** `frontend/src/lib/__tests__/api.test.ts` — `apiJson` injeta `credentials:'include'` e header `X-CSRF-Token` lido do cookie; lança erro tipado em 4xx/5xx. `[par]`
- [ ] **I:** Estender `lib/api.ts` com `apiJson`, lendo cookie CSRF. `[seq]`
- [ ] **T:** `frontend/src/api/__tests__/artworks.test.ts` — `searchArtworks`, `listArtists`, `getArtist` chamam URLs corretas com body/headers esperados (msw). `[par]`
- [ ] **I:** Criar `frontend/src/api/artworks.ts`. `[seq]`
- [ ] **T:** Tipos: `frontend/src/types/__tests__/artwork.test-d.ts` (tsd-style) — `Artist`, `Artwork`, `DominantColor` têm shape esperado. `[par]`
- [ ] **I:** Criar `frontend/src/types/artwork.ts`. `[seq]`

### 3.C — Componente `Gallery` (masonry)
- [ ] **T:** `frontend/src/components/__tests__/Gallery.test.tsx` — recebe `artworks=[a,b,c]`, renderiza 3 `<img>` com `src="/images/<thumb>"`, `loading="lazy"`, `alt={title}`. `[par]`
- [ ] **I:** Criar `frontend/src/components/Gallery.tsx` com layout CSS columns. `[seq]`
- [ ] **T:** `Gallery.responsive.test.tsx` — força viewport via `matchMedia` mock (ou class-based assertion); afirma classes responsivas presentes (2/3/4 cols). `[par]`
- [ ] **I:** Ajustar classes responsivas. `[seq]`
- [ ] **T:** `ArtworkCard.test.tsx` — barra de paleta renderiza N spans com `style.backgroundColor` espelhando `dominant_colors`. `[par]`
- [ ] **I:** Criar `ArtworkCard` interno ou subcomponente. `[seq]`
- [ ] **T:** `ArtworkCard.stagger.test.tsx` — `index` injetado vira `animation-delay: ${index*80}ms`. `[par]`
- [ ] **I:** Implementar stagger. `[seq]`

### 3.D — Componente `Lightbox`
- [ ] **T:** `Lightbox.test.tsx` — `open=true`, renderiza `<img src="/images/<large>">` + título + dimensões + link `source_page_url` com `target=_blank`. `[par]`
- [ ] **I:** Criar `frontend/src/components/Lightbox.tsx`. `[seq]`
- [ ] **T:** `Lightbox.keyboard.test.tsx` — `Esc` chama `onClose`; setas `←`/`→` navegam índice. `[par]`
- [ ] **I:** Implementar handlers de teclado + foco trap básico. `[seq]`
- [ ] **T:** `Lightbox.backdrop.test.tsx` — clique no backdrop fecha; clique na imagem não fecha. `[par]`
- [ ] **I:** Ajustar handlers de clique. `[seq]`

### 3.E — Página `Search`
- [ ] **T:** `pages/__tests__/Search.test.tsx` — render inicial: input vazio + botão buscar disabled; digitar → habilita; submit chama `searchArtworks` (msw); enquanto `isPending` mostra skeleton + "Buscando…"; em sucesso mostra `Gallery`. `[par]`
- [ ] **I:** Criar `frontend/src/pages/Search.tsx` com `useMutation` + `useQuery`. `[seq]`
- [ ] **T:** `Search.cache.test.tsx` — após sucesso, clicar artist na lista lateral chama `getArtist(slug)` sem refresh; renderiza grid imediatamente do cache do QueryClient. `[par]`
- [ ] **I:** Implementar lista lateral de artistas + click handler. `[seq]`
- [ ] **T:** `Search.refresh.test.tsx` — botão "Atualizar" dispara `searchArtworks({refresh:true})`. `[par]`
- [ ] **I:** Implementar botão. `[seq]`
- [ ] **T:** `Search.error.test.tsx` — `searchArtworks` retorna 500 → exibe mensagem em pt-BR + botão retry. `[par]`
- [ ] **I:** Implementar UI de erro. `[seq]`

### 3.F — Rotas e ProtectedRoute
- [ ] **T:** `routes.test.tsx` — `/` sem auth redireciona para `/login`; com auth renderiza `Search`. `[par]`
- [ ] **I:** Montar `BrowserRouter` + `ProtectedRoute` no `App.tsx`. `[seq]`

### 3.G — E2E Playwright Fase 3
- [ ] **T:** `frontend/e2e/gallery.spec.ts` — login → buscar "Egon Schiele" (provider mock) → aguardar grid → clicar primeira obra → lightbox abre com `image_large` → Esc fecha → clicar artista na lista → grid aparece instantâneo (sem network call de search). `[seq]`
- [ ] **I:** Garantir e2e verde (ajustes finais de timing/seletores). `[seq]`
- [ ] **T:** `frontend/e2e/gallery.mobile.spec.ts` — usa `devices['iPhone 13']`, valida grid em 2 colunas e que lightbox é usável. `[par]`
- [ ] **I:** Ajustar CSS/touch handlers até verde. `[seq]`

### 3.H — DoD Fase 3
- [ ] Manual: ciclo completo busca → grid → lightbox → cache → refresh, no desktop e mobile.
- [ ] `vitest run` + `playwright test` verdes.
- [ ] Cobertura frontend ≥ 70% linhas.

---

## Fase 4 — Coleções + provider real

**DoD:** criar coleções, adicionar/remover obras de coleções, ligar provider `brave` (principal) com fallback `serpapi`/`google`; buscas reais retornam obras de verdade.

### 4.A — Backend: coleções (TDD)
- [ ] **T:** `tests/artworks/test_collection_models.py` — `Collection(user_id, name)` e `CollectionItem(collection_id, artwork_id, note?)` persistem; unique `(collection_id, artwork_id)`. `[par]`
- [ ] **I:** Garantir que models (já criados na Fase 2) estão completos; migration adicional se necessário. `[seq]`
- [ ] **T:** `tests/artworks/test_collections_routes.py` —
  - `POST /api/collections {name}` cria, retorna 201 com id.
  - `GET /api/collections` lista coleções do usuário (não vê de outros).
  - `POST /api/collections/{id}/items {artwork_id, note?}` adiciona; duplicata retorna 409.
  - `DELETE /api/collections/{id}/items/{artwork_id}` remove.
  - `DELETE /api/collections/{id}` apaga coleção (cascade nos items).
  Tudo coberto por testes separados, um por rota. `[par]`
- [ ] **I:** Criar `backend/src/collections/router.py` (ou estender artworks), repositório, schemas. `[seq]`
- [ ] **T:** `tests/artworks/test_collections_auth.py` — user A não pode acessar coleções de user B; admin pode. `[par]`
- [ ] **I:** Implementar guard de ownership. `[seq]`

### 4.B — Frontend: coleções
- [ ] **T:** `pages/__tests__/Collections.test.tsx` — lista coleções; botão "Nova coleção" abre modal/form; criar com nome dispara mutation. `[par]`
- [ ] **I:** Criar `frontend/src/pages/Collections.tsx`. `[seq]`
- [ ] **T:** `components/__tests__/AddToCollection.test.tsx` — no lightbox, botão "Adicionar à coleção" mostra picker; submit chama API. `[par]`
- [ ] **I:** Estender `Lightbox` com ação de coleção. `[seq]`
- [ ] **T:** `pages/__tests__/CollectionDetail.test.tsx` — `/collections/:id` mostra obras da coleção em grid (reusa `Gallery`). `[par]`
- [ ] **I:** Criar `CollectionDetail.tsx` + rota. `[seq]`

### 4.C — Provider `brave` (TDD com `respx`)
- [ ] **T:** `tests/search/test_brave_provider.py`:
  - Mockar `https://api.search.brave.com/res/v1/images/search` com fixture de payload (copiar shape real do doc `docs/providers/brave-image-search.md`).
  - `BraveProvider("key").search("Egon Schiele", 10)` retorna 10 `ImageResult` deduplicados por `image_url`.
  - Header `X-Subscription-Token` enviado.
  - Erro HTTP 500 → log + retorno parcial, não exceção.
  - Variações de query: afirma 3 requests, queries diferentes.
  `[par]`
- [ ] **I:** Criar `backend/src/search/providers/brave.py`. `[seq]`
- [ ] **T:** `tests/search/test_factory_brave.py` — `IMAGE_SEARCH_PROVIDER=brave` + `BRAVE_API_KEY=xxx` → factory retorna `BraveProvider`. `[par]`
- [ ] **I:** Atualizar factory + `.env.example` (`BRAVE_API_KEY=`). `[seq]`

### 4.D — Providers alternativos
- [ ] **T:** `tests/search/test_serpapi_provider.py` — payload mock, validação igual ao brave. `[par]`
- [ ] **I:** Criar `serpapi.py`. `[seq]`
- [ ] **T:** `tests/search/test_google_provider.py` — payload mock (Google CSE), validação igual. `[par]`
- [ ] **I:** Criar `google.py`. `[seq]`
- [ ] **I:** Adicionar branches no factory + envs correspondentes. `[seq]`

### 4.E — E2E com provider real (opcional em CI)
- [ ] **T:** `frontend/e2e/real_search.spec.ts` — só roda se `BRAVE_API_KEY` exportado; busca um artista e afirma ≥ 5 obras. Marcar `@external`. `[par]`
- [ ] **I:** Adicionar ao CI como job opcional (`if: secrets.BRAVE_API_KEY`). `[seq]`

### 4.F — DoD Fase 4
- [ ] Manual: criar coleção via UI, adicionar 3 obras, ver na página da coleção, remover uma.
- [ ] Manual: com `BRAVE_API_KEY` real, buscar "Tarsila do Amaral" → grid com obras reais.
- [ ] CI verde (unit + e2e mock); e2e real verde no ambiente local.

---

## 5. Higiene final do MVP

- [ ] **S:** Revisar `.env.example` com TODAS as vars usadas até Fase 4. `[par]`
- [ ] **S:** Documentar deploy ZimaOS em `docs/deploy/zimaos.md` (Compose path, volumes, Cloudflare Tunnel). `[par]`
- [ ] **S:** Adicionar `Makefile` na raiz com `make test`, `make lint`, `make up`, `make smoke`, `make e2e`. `[par]`
- [ ] **S:** Garantir que `rg -i "save[_-]?state"` em `backend/` `frontend/` retorna 0 matches (fora de `docs/migration/`). `[par]`
- [ ] **S:** Atualizar README final com screenshots/gif do fluxo busca → galeria → lightbox. `[par]`
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

- [ ] Todas as 5 fases com DoD checado.
- [ ] CI verde: lint + tipos + unit + e2e (mock).
- [ ] Cobertura: backend ≥ 85%, frontend ≥ 70%.
- [ ] Sem strings "Save State" no código (fora de docs/migration).
- [ ] README final com instruções claras.
- [ ] Deploy ZimaOS testado manualmente em `art.meioorc.com`.
