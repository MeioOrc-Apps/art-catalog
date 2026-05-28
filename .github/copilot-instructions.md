# Copilot Instructions — Art-Catalog

Este projeto usa `AGENTS.md` (na raiz) como entrypoint canônico. **Leia-o primeiro.**

## Documentos a consultar antes de qualquer mudança

- `PRD.md` — fonte de verdade do produto (sempre consultar a fase relevante do §13 antes de codar).
- `docs/conventions/project.md` — princípios gerais (aplica-se a todo o repo).
- `docs/conventions/backend.md` — convenções para qualquer alteração em `backend/**`.
- `docs/conventions/frontend.md` — convenções para qualquer alteração em `frontend/**`.
- `docs/design/atelier-design.md` — design system único (ler antes de implementar UI).

## Skills (guias acionáveis para tarefas específicas)

Em `.agents/skills/<nome>/SKILL.md`. Leia o `SKILL.md` correspondente antes da tarefa
indicada na sua `description`:

- `fase-0-bootstrap` — scaffold inicial (Docker, hello world).
- `save-state-foundation` — copiar/adaptar a fundação de auth+infra do projeto Save State.
- `image-search-provider` — adicionar provider de busca (mock/brave/serpapi/google).
- `image-pipeline` — pipeline de download/processamento/paleta/phash de imagens.
- `gallery-ui` — Search, Gallery masonry, Lightbox (Fase 3).
- `brave-search-api` — referência operacional da Brave Search API.

## Princípios não-negociáveis (resumo)

1. Fundação (auth, CSRF, rate limit, infra) vem do Save State — copiar, não reescrever.
2. Construir em fases (PRD §13); um PR por fase com seu DoD.
3. Provider de busca pluggável; validar tudo com `mock` antes de chave real.
4. Pipeline robusta: falha numa imagem nunca derruba o lote.
5. Segredos só via `.env`; UI e comentários de domínio em português.
