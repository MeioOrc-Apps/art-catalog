---
name: fase-0-bootstrap
description: Monta a Fase 0 do Art-Catalog (Atelier): estrutura backend/frontend, Dockerfiles, docker-compose dev, .env.example, hello world FastAPI + React/Vite. Use ao iniciar o repo, criar scaffold do zero, ou quando o DoD exige docker compose up com db + api + frontend.
---

# Fase 0 — Bootstrap

**DoD (PRD §13):** `docker compose up` sobe `db` + `api` (hello world) + `frontend` (hello world).

**Não é Fase 1:** auth, CSRF e convites vêm depois — skill `save-state-foundation`. Aqui só o esqueleto mínimo.

**Referência de infra (read-only):** `/Users/sergio.sousa/Projects/person/my-apps/save-state` — copiar **padrões**, não o domínio de mídia.

---

## Árvore alvo

```
art-catalog/
├── .env.example
├── docker-compose.yml
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── src/
│       ├── main.py              # FastAPI app + /api/health
│       └── core/
│           └── config.py        # pydantic-settings mínimo
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx              # "Atelier" hello
        └── index.css            # placeholder (tokens na Fase 3)
```

---

## Backend mínimo

### `pyproject.toml` (deps Fase 0 apenas)

```toml
[project]
name = "atelier-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic-settings>=2.6",
]
```

Adicionar SQLAlchemy, Alembic, Pillow etc. **na Fase 2** — não antecipar.

### `src/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Atelier")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "app": "Atelier"}
```

### `Dockerfile`

Espelhar Save State: `python:3.12-slim`, `uv sync`, `PYTHONPATH=/app`, porta `8000`.

---

## Frontend mínimo

```bash
npm create vite@latest frontend -- --template react-ts
```

Depois instalar (Fase 3 usa tudo; Fase 0 pode só React + TS):

- `tailwindcss`, `@tailwindcss/vite` (ou postcss conforme versão atual do Vite)
- **Não** instalar shadcn/TanStack Query na Fase 0 — chegam na Fase 1/3.

### `vite.config.ts` — proxy dev

```ts
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },  // Docker no Mac
    proxy: {
      '/api': { target: 'http://api:8000', changeOrigin: true },
      '/images': { target: 'http://api:8000', changeOrigin: true },
      // Fase 1+: '/auth'
    },
  },
})
```

`App.tsx`: página simples com título **Atelier** e `fetch('/api/health')` mostrando JSON.

---

## `docker-compose.yml` (dev)

Adaptar do Save State; mudanças obrigatórias:

| Campo | Valor Atelier |
|---|---|
| `POSTGRES_DB` | `art` |
| `POSTGRES_USER` / `PASSWORD` | `art` / `art` (dev) |
| `DATABASE_URL` | `postgresql+asyncpg://art:art@db:5432/art` |
| Volume api | `./backend/src:/app/src` + volume `images:/app/data/images` |
| Portas | `127.0.0.1:5432:5432`, `127.0.0.1:8000:8000`, `5173:5173` |
| healthcheck db | manter `pg_isready` |
| api `depends_on` | `db` healthy |
| frontend | `node:20-alpine`, mount `./frontend`, `npm install && npm run dev -- --host` |

**Fase 0 — api sem Alembic no command:**

```yaml
command: uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

Montar `WATCHFILES_FORCE_POLLING: "true"` na api (padrão Save State).

**Não** copiar envs de IGDB/TMDB/Groq do Save State.

---

## `.env.example`

Copiar bloco do PRD §11. Mínimo Fase 0:

```dotenv
APP_NAME=Atelier
ENV=dev
BASE_URL=http://localhost:5173
POSTGRES_DB=art
POSTGRES_USER=art
POSTGRES_PASSWORD=art
DATABASE_URL=postgresql+asyncpg://art:art@db:5432/art
JWT_SECRET=change-me-openssl-rand-hex-32
COOKIE_NAME=artref_auth
COOKIE_SECURE=false
IMAGES_DIR=/app/data/images
IMAGE_SEARCH_PROVIDER=mock
```

---

## `.gitignore`

Incluir: `.env`, `node_modules/`, `__pycache__/`, `.venv/`, `frontend/dist/`, `backend/.venv/`, `data/images/` (se bind local).

---

## Workflow

```
- [ ] 1. Criar árvore acima (listar arquivos antes de escrever)
- [ ] 2. backend: pyproject + Dockerfile + main.py + config.py
- [ ] 3. frontend: Vite React TS + proxy /api e /images
- [ ] 4. docker-compose.yml + volumes pgdata + images
- [ ] 5. .env.example + .gitignore
- [ ] 6. cp .env.example .env (local, não commitar)
- [ ] 7. docker compose up --build
- [ ] 8. Verificar: curl http://127.0.0.1:8000/api/health
- [ ] 9. Verificar: http://localhost:5173 mostra Atelier + health JSON
- [ ] 10. Atualizar README com comandos (se ainda não tiver)
```

---

## Verificação DoD

```bash
docker compose up -d --build
curl -s http://127.0.0.1:8000/api/health | jq .
# browser: http://localhost:5173
docker compose down   # quando terminar teste
```

---

## Erros comuns

| Problema | Fix |
|---|---|
| Frontend não vê API | Proxy Vite apontando para `http://api:8000` (nome do serviço compose), não `localhost` |
| Hot reload não funciona no Docker Mac | `usePolling: true` no Vite + `WATCHFILES_FORCE_POLLING` na api |
| DB exposto na LAN | Bind `127.0.0.1:5432:5432`, nunca `5432:5432` |
| Escopo creep | Não adicionar auth, models de arte, nem shadcn nesta fase |

---

## Próxima fase

Fase 1 → skill `save-state-foundation` (copiar auth do Save State para este scaffold).
