# Art Catalog

Catálogo pessoal de referências artísticas e moodboard. Você digita o nome de um artista; a aplicação busca obras na web, processa as imagens (3 versões + paleta de cores + phash) e exibe numa galeria masonry. Conta também com upload manual de imagens, organização por coleções, filtro global por paleta de cores e um moodboard interativo.

> **Self-hosted**, registro fechado por convite. Roda em Docker Compose no ZimaOS atrás de Cloudflare Tunnel.

![Art Catalog Preview](https://via.placeholder.com/1200x600/18181b/d4a574?text=Art+Catalog+Preview)

## Funcionalidades (MVP)

- **Busca Automatizada:** Integração com Brave Search para baixar e processar obras de artistas automaticamente.
- **Upload Manual:** Adicione imagens locais diretamente ao catálogo de um artista.
- **Moodboard Interativo:** Tela infinita com drag & drop, redimensionamento e ordenação (z-index) para criar painéis de referência.
- **Coleções Pessoais:** Agrupe obras de diferentes artistas em pastas temáticas.
- **Filtro por Paleta de Cores:** Explore todo o seu acervo filtrando por cores dominantes (extraídas automaticamente).
- **Gestão de Usuários:** Painel Admin para controle de convites, ativação de contas e atribuição de cargos (Admin/Membro).
- **Deduplicação Inteligente:** Usa `imagehash` (phash) para evitar imagens repetidas no banco.

## Documentação Interna

- **[PRD.md](./PRD.md)** — especificação completa (fonte de verdade).
- **[AGENTS.md](./AGENTS.md)** — guia para agentes de IA (Cursor, Claude Code, Codex, Copilot…).
- **[PLANO_DE_IMPLEMENTACAO.md](./PLANO_DE_IMPLEMENTACAO.md)** — roadmap e checklist de desenvolvimento.
- **[docs/design/atelier-design.md](./docs/design/atelier-design.md)** — design system (spec única).

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 async + PostgreSQL · Pillow + colorthief + imagehash
- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4 + TanStack Query · react-rnd (Moodboard)
- **Infra:** Docker Compose · Cloudflare Tunnel

## Como rodar localmente

```bash
# 1. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 2. Suba os containers
docker compose up -d --build

# 3. Verifique se a API está de pé
curl http://127.0.0.1:8000/api/health
# → {"status":"ok","app":"Art Catalog"}
```

O frontend estará disponível em `http://localhost:5173`.

O primeiro usuário admin será criado automaticamente com as credenciais definidas no `.env` (`FIRST_ADMIN_EMAIL` e `FIRST_ADMIN_PASSWORD`).

Faça login, busque um artista, crie suas coleções e monte seus moodboards!
