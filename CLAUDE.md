# CLAUDE.md

Este projeto usa `AGENTS.md` como entrypoint canônico para qualquer agente de IA.

**Leia `AGENTS.md` na raiz primeiro.** Ele lista:

- A fonte de verdade do produto (`PRD.md`).
- As convenções de código (`docs/conventions/*.md`).
- As skills disponíveis em `.claude/skills/` (espelho de `.agents/skills/`).
- O fluxo recomendado para iniciar uma tarefa.

> `.claude/skills/` é um symlink para `.agents/skills/` — o conteúdo é o mesmo
> que Cursor vê em `.cursor/skills/`. Single source of truth.
