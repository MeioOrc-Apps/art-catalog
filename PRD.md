# PRD — Art-Catalog: Catálogo de Referências Artísticas

## TL:DR
Art-Catalog — Descrição Geral
Aplicação pessoal self-hosted para montar um banco de referências artísticas a partir do nome de um artista. Você digita "Egon Schiele", "Beksiński" ou "Tarsila do Amaral", e a aplicação busca imagens das obras na web, baixa em boa resolução, processa e exibe numa galeria visual de alto apelo. Buscas seguintes do mesmo artista vêm do cache local, sem rebater nas APIs externas.
O foco é ser um buscador visual de obras por artista — não uma wiki. A informação textual (biografia) é um plus futuro; o coração é a galeria.
Como funciona, em uma frase: nome do artista → busca de imagens → download e processamento → galeria masonry com lightbox.
O que faz no MVP:

Busca de obras pelo nome do artista, via provider pluggável: Brave Search API como provider principal (2000 queries/mês grátis, setup simples), com SerpAPI e Google CSE como alternativas e um mock offline para desenvolvimento
Download e processamento de cada imagem em três versões (original, large 2000px, thumb 400px)
Extração da paleta de cores dominante de cada obra
Deduplicação por perceptual hash, descartando imagens repetidas
Cache: artista já buscado é servido do banco local, com opção de forçar atualização
Galeria masonry com lightbox, estética art-first (tema escuro, a obra como protagonista)
Usabilidade impecável em desktop e mobile — layout responsivo de verdade: o grid se adapta de 2 a 4 colunas conforme a tela, lightbox com gestos de toque no celular, busca confortável tanto no teclado quanto no touch. Mobile não é adaptação tardia, é requisito de primeira classe
Coleções pessoais para agrupar referências favoritas
Autenticação e registro por convite, reaproveitados do Save State

Stack: FastAPI + PostgreSQL + Pillow no backend, React + Vite + Tailwind no frontend, rodando em Docker Compose no seu ZimaOS atrás de Cloudflare Tunnel, em art-catalog.meioorc.com. Acesso compartilhado com a Lauranne via convite.
O diferencial: não existe alternativa open-source que faça exatamente isso (busca por artista auto-populando uma galeria de referência). É um nicho vazio — os projetos próximos são moodboards manuais, portfólios pessoais ou dados brutos de acervos museológicos.

## 1. Visão geral

Aplicação pessoal self-hosted para **buscar obras de um artista pelo nome** e exibi-las
numa galeria visual de alta qualidade, servindo como banco de referência artística.
O usuário digita o nome de um artista; a aplicação busca imagens na web, baixa em boa
resolução, processa e persiste, e exibe num grid masonry. Buscas posteriores do mesmo
artista vêm do cache local.

- **Domínio:** `art.meioorc.com`
- **Usuários:** privado, registro fechado por convite (Sérgio + Lauranne).
- **Plataforma:** ZimaOS (homelab), Docker Compose, atrás de Cloudflare Tunnel.

## 2. Escopo

### Dentro do MVP
- [ ] Busca de obras por nome de artista.
- [ ] Download e processamento de imagens em boa resolução (original / large / thumb).
- [ ] Extração de paleta de cores dominante por obra.
- [ ] Deduplicação de imagens repetidas.
- [ ] Cache: artista já buscado não rebate na API externa (com opção de `refresh`).
- [ ] Galeria masonry com lightbox.
- [ ] Coleções pessoais (agrupar obras favoritas).
- [ ] Autenticação e convites (reusar do Save State — ver seção 4).

### Fora do MVP (plus futuro)
- Wiki / biografia enriquecida por LLM.
- Busca por similaridade visual (embeddings/CLIP).
- Filtro por paleta de cores.

## 3. Stack

| Camada | Tecnologia |
|---|---|
| Backend | FastAPI, SQLAlchemy 2.0 async, Alembic |
| Banco | PostgreSQL |
| Auth | fastapi-users (JWT em cookie httpOnly) |
| Imagens | Pillow, colorthief, imagehash, httpx |
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui |
| Estado/dados | TanStack Query, React Router, React Hook Form + Zod |
| Infra | Docker Compose, Nginx, Cloudflare Tunnel |

## 4. Fundação reaproveitada (Save State)

A fundação **não deve ser reescrita** — copiar do repositório Save State e adaptar nomes:

- você podee ler o repo aqui /Users/sergio.sousa/Projects/person/my-apps/save-state
- `auth/` completo: fastapi-users, JWT httpOnly, bcrypt, roles `admin`/`member`.
- Registro fechado por convite (`POST /auth/register-with-invite`, admin gera código).
- Middleware CSRF (double-submit cookie, header `X-CSRF-Token` em rotas mutáveis).
- Rate limit em `/auth` (5 tentativas/IP a cada 5 min).
- Cookies `Secure`/`SameSite=Lax`, HTTPS em produção.
- Base de `docker-compose`, Nginx, GitHub Actions CI/CD.
- Páginas de login / registro-com-convite e cliente de API com cookie no frontend.

> Adaptar apenas: nome do cookie (`artref_auth`), domínio, e variáveis de ambiente.
> O que segue neste PRD é **apenas a parte nova** (domínio de arte).

## 5. Arquitetura

```
Frontend (React)
   │  POST /api/artworks/search { artist, limit, refresh }
   ▼
FastAPI
   ├── cache hit?  → retorna artista + obras do Postgres
   └── cache miss  → SearchService
                        ├── ImageSearchProvider (serpapi | google | mock)
                        ├── ImagePipeline (download → resize → paleta → phash)
                        └── persiste Artist + Artworks
   ▼
Postgres (metadados)  +  filesystem (/app/data/images)
   ▼
StaticFiles monta /images  → frontend renderiza grid
```

Decisão: download **síncrono** no MVP (busca espera o processamento). Assíncrono com
fila fica para V2 se a latência incomodar com artistas de muitas obras.

## 6. Modelo de dados

```sql
artists
  id              UUID PK
  slug            TEXT UNIQUE        -- slugify(canonical_name)
  canonical_name  TEXT
  bio_short       TEXT NULL
  cover_artwork_id UUID NULL
  last_searched_at TIMESTAMPTZ NULL
  created_at      TIMESTAMPTZ

artworks
  id              UUID PK
  artist_id       UUID FK → artists (ON DELETE CASCADE)
  title           TEXT NULL
  source_page_url TEXT NULL
  source_image_url TEXT
  image_original  TEXT NULL          -- path relativo a IMAGES_DIR
  image_large     TEXT NULL
  image_thumb     TEXT NULL
  width           INT NULL
  height          INT NULL
  dominant_colors JSONB NULL         -- [[r,g,b], ...]
  phash           TEXT NULL          -- perceptual hash p/ dedup
  is_downloaded   BOOL DEFAULT false
  created_at      TIMESTAMPTZ
  UNIQUE (artist_id, phash)

collections
  id              UUID PK
  user_id         UUID FK → users (ON DELETE CASCADE)
  name            TEXT
  created_at      TIMESTAMPTZ

collection_items
  id              UUID PK
  collection_id   UUID FK → collections (ON DELETE CASCADE)
  artwork_id      UUID FK → artworks (ON DELETE CASCADE)
  note            TEXT NULL
  added_at        TIMESTAMPTZ
  UNIQUE (collection_id, artwork_id)
```

## 7. Provider de busca de imagens

Interface pluggável, selecionada por `IMAGE_SEARCH_PROVIDER`. Implementar três:

| Provider | Quando usar | Notas |
|---|---|---|
| `mock` | dev sem chave de API | gera imagem sintética local (Pillow), 100% offline |
| `brave` | produção | principal ferramenta de busca; documentação em `docs/providers/brave-web-search.md` e `docs/providers/brave-image-search.md` |
| `serpapi` | produção | SerpAPI Google Images; retorna `original` + dimensões |
| `google` | alternativa | Google CSE JSON API (`searchType=image`), 100 queries/dia grátis |

Contrato da interface:

```python
@dataclass
class ImageResult:
    image_url: str
    title: str | None
    page_url: str | None
    width: int | None
    height: int | None

class ImageSearchProvider(Protocol):
    async def search(self, query: str, limit: int) -> list[ImageResult]: ...
```

Gerar variações de query para melhorar recall/qualidade, ex.:
`"{artista} painting artwork high resolution"`, `"{artista} obras de arte"`,
`"{artista} artwork museum"`.

## 8. Pipeline de imagens

Para cada `ImageResult`, em ordem:

1. `HEAD` para checar `Content-Length`; pular se `> MAX_DOWNLOAD_MB`.
2. `GET` em streaming (httpx, `follow_redirects=True`).
3. Abrir com Pillow; **descartar se largura `< MIN_IMAGE_WIDTH`** (corta thumbnails de blog).
4. Gerar três versões e salvar como JPEG:
   - `original` (como veio, q=95)
   - `large` (lado maior = 2000px, q=90)
   - `thumb` (lado maior = 400px, q=80)
5. Extrair `dominant_colors` (colorthief, 5 cores) a partir do thumb.
6. Calcular `phash` (imagehash); **dedup**: se `phash` já existe para o artista, descartar.
7. Salvar em `IMAGES_DIR/{artist_slug}/{sha256(url)[:2]}/{sha256(url)}*.jpg`.

Requisitos de robustez:
- [ ] Falha ao baixar/processar **uma** imagem nunca derruba o lote (try/except por item, log e segue).
- [ ] `mock://` é tratado pela pipeline gerando imagem local (não faz rede).

## 9. API (somente rotas novas; auth vem do Save State)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/artworks/search` | body `{artist, limit?, refresh?}` → artista + obras. Rate limit 10/min. Cache por slug. |
| GET | `/api/artworks/artists` | lista artistas já buscados |
| GET | `/api/artworks/artists/{slug}` | artista + obras |
| POST | `/api/collections` | cria coleção `{name}` |
| POST | `/api/collections/{id}/items` | adiciona obra `{artwork_id, note?}` |
| GET | `/api/health` | healthcheck |

Imagens servidas em `/images/...` (StaticFiles montado em `IMAGES_DIR`).

## 10. Frontend

Estética **art-first**: tema escuro neutro, tipografia editorial (display serif +
sans), a obra é a protagonista. **Não** usar a paleta verde/âmbar do MeioOrc aqui —
competiria com as imagens.

**Design system (agentes e implementação):** [`docs/design/atelier-design.md`](./docs/design/atelier-design.md)
— spec visual única (dark premium + galeria estruturada).

Páginas:
- `Login` e `Register` (registro por convite) — reusar padrão do Save State.
- `Search` (rota protegida `/`): campo de busca centralizado + galeria de resultados.

Componentes-chave:
- `Gallery`: grid masonry (CSS columns, sem dependência extra), reveal escalonado no load.
  Cada card mostra o thumb + barra fina com a paleta de cores dominante.
- `Lightbox`: abre a versão `large`, mostra título, dimensões e link da fonte; fecha no Esc.

Comportamento de busca:
- Estado de loading explícito enquanto o backend baixa as imagens.
- Após buscar, persistir na lista de artistas; permitir reabrir do cache.
- Botão "atualizar" dispara `refresh: true`.

## 11. Variáveis de ambiente

```dotenv
# App
APP_NAME=Atelier
ENV=dev
BASE_URL=http://localhost:5173

# Banco
DATABASE_URL=postgresql+asyncpg://art:art@db:5432/art

# Auth / cookies  (ver Save State)
JWT_SECRET=                      # openssl rand -hex 32
COOKIE_NAME=artref_auth
COOKIE_SECURE=false              # true em produção
COOKIE_DOMAIN=                   # .meioorc.com em produção
FIRST_ADMIN_EMAIL=sergio@meioorc.com
FIRST_ADMIN_PASSWORD=

# Busca de imagens
IMAGE_SEARCH_PROVIDER=mock       # mock | serpapi | google
SERPAPI_KEY=
GOOGLE_CSE_KEY=
GOOGLE_CSE_CX=

# Storage
IMAGES_DIR=/app/data/images
MAX_DOWNLOAD_MB=25
MIN_IMAGE_WIDTH=700
DEFAULT_RESULTS_PER_SEARCH=30
```

## 12. Deploy no ZimaOS

- Compose em `/var/lib/casaos/apps/art-reference/docker-compose.yml`.
- Volume bind: `/DATA/AppData/art-reference/images:/app/data/images`.
- Serviços: `db` (Postgres), `api` (FastAPI), `frontend` (build estático servido por Nginx).
- Cloudflare Tunnel: `art` → `meioorc.com` → `HTTP localhost:{porta_frontend}`.
- Atualização: `docker compose pull && docker compose up -d --force-recreate`.

## 13. Roadmap por fases

### Fase 0 — Bootstrap
- [ ] Estrutura de pastas backend/frontend, Dockerfiles, `docker-compose.yml` (dev), `.env.example`, README.
- **DoD:** `docker compose up` sobe `db` + `api` (hello world) + `frontend` (hello world).

### Fase 1 — Fundação (copiar do Save State)
- [ ] Auth, convites, CSRF, rate limit, roles, páginas de login/registro.
- **DoD:** criar admin, gerar convite, registrar member, login persistente, logout.

### Fase 2 — Busca e pipeline
- [ ] Models de domínio + migration; providers (mock primeiro); pipeline de imagens; `POST /artworks/search`.
- **DoD:** com `mock`, buscar "Egon Schiele" baixa N imagens, gera 3 versões + paleta, persiste, dedup funciona.

### Fase 3 — Galeria
- [ ] Página de busca, `Gallery` masonry, `Lightbox`, estado de loading, lista de artistas (cache).
- **DoD:** buscar pela UI exibe o grid; clicar abre o lightbox; rebuscar usa cache.

### Fase 4 — Coleções + provider real
- [ ] Coleções pessoais; ligar `serpapi`/`google`; filtro mínimo.
- **DoD:** criar coleção, adicionar obras; busca real retorna obras de verdade.

## 14. Riscos / decisões em aberto

- **Direitos autorais:** uso pessoal. Guardar `source_page_url`; obras de artistas vivos podem
  ter restrição — decidir later se hospeda ou só linka.
- **Cobertura de artistas BR/contemporâneos:** busca via Google/SerpAPI cobre bem (não depende de
  acervo de museu). Confirmar qualidade em testes.
- **Latência síncrona** com artistas de muitas obras: medir; mover para fila se necessário (V2).
- **Custo de storage:** imagens grandes; `MAX_DOWNLOAD_MB` e versão `large` em 2000px controlam.
