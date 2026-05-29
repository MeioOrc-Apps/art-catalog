# Art Catalog

<div align="center">
  <img src="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/gallery.png" alt="Art Catalog Icon" width="120" />
  <p><em>Catálogo pessoal de referências artísticas e moodboard.</em></p>
</div>

Você digita o nome de um artista; a aplicação busca obras na web, processa as imagens (3 versões + paleta de cores + phash) e exibe numa galeria masonry. Conta também com upload manual de imagens, organização por coleções, filtro global por paleta de cores e um moodboard interativo.

> **Self-hosted**, registro fechado por convite. Roda em Docker Compose no ZimaOS atrás de Cloudflare Tunnel.

## 🌟 Funcionalidades (MVP)

- **Busca Automatizada:** Integração com Brave Search para baixar e processar obras de artistas automaticamente.
- **Upload Manual:** Adicione imagens locais diretamente ao catálogo de um artista.
- **Moodboard Interativo:** Tela infinita com drag & drop, redimensionamento e ordenação (z-index) para criar painéis de referência.
- **Coleções Pessoais:** Agrupe obras de diferentes artistas em pastas temáticas.
- **Filtro por Paleta de Cores:** Explore todo o seu acervo filtrando por cores dominantes (extraídas automaticamente).
- **Gestão de Usuários:** Painel Admin para controle de convites, ativação de contas e atribuição de cargos (Admin/Membro).
- **Deduplicação Inteligente:** Usa `imagehash` (phash) para evitar imagens repetidas no banco.

## 🛠️ Stack Tecnológico

- **Backend:** FastAPI + SQLAlchemy 2.0 async + PostgreSQL · Pillow + colorthief + imagehash
- **Frontend:** React + Vite + TypeScript + Tailwind CSS v4 + TanStack Query · react-rnd (Moodboard)
- **Infra:** Docker Compose · Cloudflare Tunnel · GitHub Actions (GHCR)

---

## 💻 Como rodar localmente para Desenvolvimento

Se você deseja modificar o código ou testar localmente na sua máquina:

### 1. Requisitos
- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/) instalados.
- Git.

### 2. Passos

```bash
# Clone o repositório
git clone https://github.com/SergioSJS/art-catalog.git
cd art-catalog

# Copie o arquivo de variáveis de ambiente
cp .env.example .env
# (Opcional) Edite o .env para adicionar suas chaves de API (ex: Brave Search)

# Suba os containers em modo detached (segundo plano)
docker compose up -d --build
```

### 3. Acessando a Aplicação
- **Frontend:** `http://localhost:5173`
- **Backend API Docs (Swagger):** `http://localhost:8000/docs`

O primeiro usuário admin será criado automaticamente com as credenciais definidas no `.env` (`FIRST_ADMIN_EMAIL` e `FIRST_ADMIN_PASSWORD`).

### 4. Acompanhando os Logs e Comandos Úteis

Para debugar ou ver o que está acontecendo por baixo dos panos:

```bash
# Ver logs de todos os containers em tempo real
docker compose logs -f

# Ver logs apenas da API (Backend)
docker compose logs -f api

# Ver logs apenas do Frontend
docker compose logs -f frontend

# Parar a aplicação
docker compose down

# Parar a aplicação e apagar o banco de dados (Reset completo)
docker compose down -v
```

---

## 🚀 Implantação no ZimaOS / CasaOS

O Art Catalog foi desenhado para rodar perfeitamente no seu servidor doméstico (ZimaOS/CasaOS). As imagens Docker são construídas automaticamente pelo GitHub Actions e hospedadas no GitHub Container Registry (GHCR).

### Instalação via "Custom App"

1. Acesse o painel do seu ZimaOS / CasaOS.
2. Clique no ícone de `+` (Install a customized app).
3. No canto superior direito, clique em **Import**.
4. Cole o conteúdo do arquivo [`docker-compose.zimaos.yml`](./docker-compose.zimaos.yml) que está na raiz deste repositório.
5. **Importante:** Antes de clicar em instalar, revise as variáveis de ambiente na interface do ZimaOS:
   - `JWT_SECRET`: Mude para uma string segura e aleatória.
   - `FIRST_ADMIN_EMAIL`: Seu email de login.
   - `FIRST_ADMIN_PASSWORD`: Sua senha.
6. Clique em **Install**. O ZimaOS fará o download das imagens do GHCR e o aplicativo aparecerá no seu painel com o ícone correto!

### Gestão de Versões e Atualizações

A infraestrutura utiliza o GitHub Actions para gerar imagens Docker automaticamente. Existem duas formas de gerenciar as atualizações no seu servidor:

- **Atualizações Contínuas (Padrão):** O arquivo `docker-compose.zimaos.yml` aponta para a tag `:latest`. Toda vez que um novo código é enviado para a branch `main`, o GitHub gera uma nova imagem `:latest`. O ZimaOS detectará a mudança e exibirá um aviso de "Update" no painel.
- **Versões Estáveis (Rollbacks/Fixas):** Sempre que um ciclo de desenvolvimento é fechado, uma tag de versão é criada (ex: `v0.1.0`). O GitHub gera uma imagem fixa para essa versão. Se você deseja estabilidade total ou precisa reverter uma atualização, vá nas configurações do aplicativo no ZimaOS e altere a tag da imagem de `:latest` para a versão desejada (ex: `ghcr.io/sergiosjs/art-catalog-api:0.1.0`).

**Como gerar uma nova versão (Para desenvolvedores):**

```bash
# 1. Crie a tag da nova versão
git tag -a v0.2.0 -m "Release v0.2.0"

# 2. Envie a tag para o GitHub (aciona a criação das imagens fixas)
git push origin v0.2.0
```

---

## 📚 Documentação Interna

- **[PRD.md](./PRD.md)** — Especificação completa (fonte de verdade).
- **[AGENTS.md](./AGENTS.md)** — Guia para agentes de IA (Cursor, Claude Code, Codex, Copilot…).
- **[PLANO_DE_IMPLEMENTACAO.md](./PLANO_DE_IMPLEMENTACAO.md)** — Roadmap e checklist de desenvolvimento.
- **[docs/design/atelier-design.md](./docs/design/atelier-design.md)** — Design system (spec única).
