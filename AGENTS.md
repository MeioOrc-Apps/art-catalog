# AGENTS.md — Art-Catalog (Atelier)

Entrypoint canônico para **qualquer** agente de IA que trabalhe neste repositório (Cursor, Claude Code, GitHub Copilot, Codex CLI, Aider, Cline, Continue, etc.). Toda a documentação do projeto que orienta agentes está em arquivos plain markdown — o que muda entre ferramentas é apenas o caminho que cada uma "olha por default".

## O que é este projeto

Aplicação pessoal self-hosted: o usuário digita o nome de um artista, a app busca obras na web, processa as imagens (3 versões + paleta + phash) e exibe numa galeria masonry. Cache local por artista.

A **fonte de verdade** do produto é [`PRD.md`](./PRD.md). Antes de implementar qualquer coisa, leia o PRD e a fase relevante da seção 13 (roadmap).

## Princípios não-negociáveis

1. **Fundação reaproveitada do Save State** (auth, convites, CSRF, rate limit, infra). Está em `/Users/sergio.sousa/Projects/person/my-apps/save-state` — **copiar e adaptar**, não reescrever. Veja a skill `save-state-foundation`.
2. **Construir em fases** (PRD §13). Um PR por fase, cada fase com seu DoD. Não pular.
3. **Provider de busca pluggável**. Sempre validar com o provider `mock` (offline) antes de plugar `brave`/`serpapi`/`google`. Skill: `image-search-provider`.
4. **Robustez na pipeline**. Falha em uma imagem nunca derruba o lote. Skill: `image-pipeline`.
5. **Segredos só via `.env`** (no `.gitignore`). `.env.example` sempre atualizado. O repo pode ser público.
6. **Português** em UI, mensagens e comentários de domínio.

## Stack (não trocar sem combinar)

- **Backend:** FastAPI, SQLAlchemy 2.0 async, Alembic, fastapi-users, Pillow, httpx, colorthief, imagehash.
- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui, TanStack Query, React Router, React Hook Form + Zod.
- **Banco:** PostgreSQL. **Infra:** Docker Compose + Nginx + Cloudflare Tunnel no ZimaOS.

## Convenções por área (fonte canônica)

Plain markdown — qualquer agente lê:

- [`docs/conventions/project.md`](./docs/conventions/project.md) — princípios gerais (aplica-se a todo o repo).
- [`docs/conventions/backend.md`](./docs/conventions/backend.md) — quando editar `backend/**`.
- [`docs/conventions/frontend.md`](./docs/conventions/frontend.md) — quando editar `frontend/**`.
- [`docs/design/atelier-design.md`](./docs/design/atelier-design.md) — design system único (ler antes de UI).

## Skills do projeto

Guias acionáveis para tarefas específicas. **Fonte canônica:** `.agents/skills/<nome>/SKILL.md`.
Espelhados via symlink em `.cursor/skills/` e `.claude/skills/` — todos apontam para o mesmo conteúdo.

| Skill | Quando usar |
|---|---|
| [`fase-0-bootstrap`](./.agents/skills/fase-0-bootstrap/SKILL.md) | Scaffold inicial: backend/frontend, Docker, hello world (Fase 0). |
| [`save-state-foundation`](./.agents/skills/save-state-foundation/SKILL.md) | Copiar/adaptar a fundação de auth+infra do Save State (Fase 1). |
| [`image-search-provider`](./.agents/skills/image-search-provider/SKILL.md) | Adicionar/modificar provider de busca (mock/brave/serpapi/google). |
| [`image-pipeline`](./.agents/skills/image-pipeline/SKILL.md) | Pipeline de download/processamento/paleta/phash. |
| [`gallery-ui`](./.agents/skills/gallery-ui/SKILL.md) | Página Search, Gallery masonry, Lightbox, cache de artistas (Fase 3). |
| [`brave-search-api`](./.agents/skills/brave-search-api/SKILL.md) | Referência operacional da Brave Search API. |

Mesmo se seu agente não tiver mecanismo nativo de "skill", **leia o `SKILL.md` correspondente** antes da tarefa indicada na sua descrição.

## Estrutura do repositório

```
art-catalog/
├── AGENTS.md                       # este arquivo — entrypoint universal
├── CLAUDE.md                       # pointer para AGENTS.md (Claude Code)
├── README.md                       # visão humana resumida
├── PRD.md                          # fonte de verdade do produto
├── .github/
│   └── copilot-instructions.md     # pointer para AGENTS.md (GitHub Copilot)
├── .cursor/
│   ├── rules/                      # *.mdc com frontmatter (globs/alwaysApply)
│   │   ├── 000-project.mdc         #   → @ docs/conventions/project.md
│   │   ├── 100-backend.mdc         #   → @ docs/conventions/backend.md
│   │   └── 200-frontend.mdc        #   → @ docs/conventions/frontend.md
│   └── skills → ../.agents/skills  # symlink
├── .claude/
│   └── skills → ../.agents/skills  # symlink
├── .agents/
│   └── skills/                     # CANÔNICO: skills do projeto
│       ├── fase-0-bootstrap/SKILL.md
│       ├── save-state-foundation/SKILL.md
│       ├── image-search-provider/SKILL.md
│       ├── image-pipeline/SKILL.md
│       ├── gallery-ui/SKILL.md
│       └── brave-search-api/SKILL.md
├── docs/
│   ├── conventions/                # CANÔNICO: convenções de código (plain md)
│   │   ├── project.md
│   │   ├── backend.md
│   │   └── frontend.md
│   ├── design/
│   │   ├── atelier-design.md       # design system ÚNICO (UI)
│   │   └── README.md               # pointer → atelier-design.md
│   └── providers/
│       ├── brave-web-search.md
│       └── brave-image-search.md
├── backend/                        # (a criar na Fase 0)
└── frontend/                       # (a criar na Fase 0)
```

## Como cada ferramenta encontra o conteúdo

| Ferramenta | Lê primeiro | Como chega no conteúdo |
|---|---|---|
| **Cursor** | `.cursor/rules/*.mdc` (auto, por glob) | `.mdc` faz `@docs/conventions/*.md` |
| **Cursor (skills)** | `.cursor/skills/` (invocável por nome) | symlink → `.agents/skills/` |
| **Claude Code** | `CLAUDE.md` → `AGENTS.md` | `AGENTS.md` lista `docs/` e `.claude/skills/` (symlink) |
| **GitHub Copilot** | `.github/copilot-instructions.md` → `AGENTS.md` | idem |
| **Codex CLI** | `AGENTS.md` (nativo) | idem |
| **Aider / Cline / Continue** | `AGENTS.md` (suporte nativo) | idem |

**Single source of truth:** alterar uma convenção significa editar **uma** linha em `docs/conventions/*.md` — todas as ferramentas veem a mudança automaticamente.

## Fluxo recomendado para iniciar uma tarefa

1. Identifique a fase (PRD §13) e leia o DoD.
2. Leia o `docs/conventions/*.md` aplicável ao caminho que vai editar. Em `frontend/**`, leia também `docs/design/atelier-design.md`.
3. Se a tarefa for uma das cobertas por skills, leia a `SKILL.md` em `.agents/skills/<nome>/`:
   - Scaffold Docker/hello world → `fase-0-bootstrap`
   - Copiar auth/infra do Save State → `save-state-foundation`
   - Adicionar provider de busca → `image-search-provider`
   - Implementar pipeline de imagem → `image-pipeline`
   - UI da galeria (Search, masonry, lightbox) → `gallery-ui`
   - Implementar provider `brave` → `brave-search-api`
4. Liste os arquivos que vai criar/alterar e o porquê **antes** de começar.
5. Mantenha o lote pequeno; um PR por fase.

## Comandos úteis (após Fase 0)

```bash
docker compose up -d         # sobe db + api + frontend
docker compose logs -f api   # acompanha logs do backend
docker compose down -v       # reset completo (apaga volumes)
```
