# Deploy no ZimaOS

O Art-Catalog (Atelier) foi desenhado para rodar no homelab (ZimaOS) via Docker Compose e ser exposto externamente via Cloudflare Tunnel.

## 1. Estrutura de Diretórios no ZimaOS

Recomendamos utilizar o diretório padrão de apps do CasaOS/ZimaOS:

```bash
/DATA/AppData/art-catalog/
├── docker-compose.yml
├── .env
└── images/           # Volume persistente para as imagens baixadas
```

## 2. Configurando o `.env`

Copie o `.env.example` do repositório para o servidor e ajuste as variáveis:

```dotenv
APP_NAME=Atelier
ENV=prod
BASE_URL=https://art.meioorc.com

DATABASE_URL=postgresql+asyncpg://art:art@db:5432/art

JWT_SECRET=seu-segredo-super-seguro
COOKIE_NAME=artref_auth
COOKIE_SECURE=true
COOKIE_DOMAIN=.meioorc.com
FIRST_ADMIN_EMAIL=sergio@meioorc.com
FIRST_ADMIN_PASSWORD=sua-senha-forte

IMAGE_SEARCH_PROVIDER=brave
BRAVE_API_KEY=sua-chave-da-api-brave

IMAGES_DIR=/app/data/images
MAX_DOWNLOAD_MB=25
MIN_IMAGE_WIDTH=700
DEFAULT_RESULTS_PER_SEARCH=30
```

## 3. Cloudflare Tunnel

Configure um túnel no Cloudflare Zero Trust apontando o domínio `art.meioorc.com` para o serviço frontend local.

- **Public Hostname:** `art.meioorc.com`
- **Service:** `HTTP` -> `localhost:5173` (ou a porta que você mapeou no frontend do docker-compose)

## 4. Subindo a Aplicação

Navegue até o diretório e suba os containers:

```bash
cd /DATA/AppData/art-catalog/
docker compose pull
docker compose up -d
```

## 5. Atualizando a Aplicação

Para atualizar para a versão mais recente:

```bash
cd /DATA/AppData/art-catalog/
docker compose pull
docker compose up -d --force-recreate
```
