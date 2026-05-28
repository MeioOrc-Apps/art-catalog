# Projeto: Atelier — Catálogo de Referências Artísticas

Aplicação pessoal self-hosted. O usuário busca um artista pelo nome; a app busca imagens
na web, baixa em boa resolução, processa e exibe numa galeria visual. Ver `PRD.md` na raiz
para a especificação completa — ela é a fonte de verdade.

## Princípios

- **Fundação reaproveitada:** auth, convites, CSRF, rate limit, roles, infra base vêm do
  projeto Save State. NÃO reescrever do zero — copiar e adaptar (cookie `artref_auth`,
  domínio, env vars). Só implementar do zero o domínio de arte.
- **Construir em fases** conforme o roadmap do PRD (seção 13). Um PR por fase, cada fase
  com seu DoD. Não pular fase.
- **Provider de busca pluggável:** começar e validar tudo com `mock` (offline, sem chave de
  API) antes de ligar `serpapi`/`google`.
- **Robustez na pipeline:** falha ao processar uma imagem nunca pode derrubar o lote inteiro.
- **Segredos só via `.env`** (no `.gitignore`). `.env.example` sempre atualizado. Repo pode
  ser público.

## Stack (não trocar sem pedir)

- Backend: FastAPI, SQLAlchemy 2.0 async, Alembic, fastapi-users, Pillow, httpx.
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui, TanStack Query, React Router.
- Banco: PostgreSQL. Infra: Docker Compose + Nginx + Cloudflare Tunnel no ZimaOS.

## Convenções gerais

- Português nos textos de UI, mensagens e comentários de domínio.
- Saídas de código limpas e copy-paste-ready; nada de placeholders TODO sem necessidade.
- Antes de implementar uma fase, listar os arquivos que vai criar/alterar e o porquê.
