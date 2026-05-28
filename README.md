# Art-Catalog (Atelier)

Catálogo pessoal de referências artísticas. Você digita o nome de um artista; a app busca obras na web, processa as imagens (3 versões + paleta + phash) e exibe numa galeria masonry. Cache local por artista, deduplicação por hash perceptual.

> **Self-hosted**, registro fechado por convite. Roda em Docker Compose no ZimaOS atrás de Cloudflare Tunnel.

## Documentação

- **[PRD.md](./PRD.md)** — especificação completa (fonte de verdade).
- **[AGENTS.md](./AGENTS.md)** — guia para agentes de IA (Cursor, Claude Code, Codex, Copilot…).
- **[docs/design/atelier-design.md](./docs/design/atelier-design.md)** — design system (spec única).
- **[docs/providers/](./docs/providers/)** — referência das APIs de busca de imagens.

## Stack

FastAPI + SQLAlchemy 2.0 async + PostgreSQL · React + Vite + TypeScript + Tailwind + shadcn/ui · Pillow + colorthief + imagehash · Docker Compose · Cloudflare Tunnel.

## Status

Em bootstrap (Fase 0 do roadmap). Ver PRD §13.
