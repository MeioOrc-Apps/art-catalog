# Análise, Sugestões de Features e Falhas de Segurança — Art Catalog

> Documento gerado em 2026-06-01 após o MVP completo (Fases 0–7).

---

## 1. O que é e o problema que resolve

O Art Catalog resolve um problema pessoal específico: **não existe ferramenta open-source que popule automaticamente uma galeria de referências visuais a partir do nome de um artista**. O que existe hoje são:

- Moodboards manuais (Milanote, Are.na, Pinterest) — requerem curadoria de cada imagem à mão.
- Acervos museológicos (Artsy, Wikiart) — focados em dados, não em referência visual rápida.
- Pastas no Finder — sem paleta, sem deduplicação, sem moodboard.

A solução: **nome do artista → busca automática → galeria pronta em segundos**, self-hosted, privado, com paleta de cores e moodboard interativo. O diferencial está na automação do pipeline de imagens (download + 3 versões + phash + palette) combinada com uma UI art-first.

### Stack atual (síntese)

| Camada | Tecnologia |
|---|---|
| API | FastAPI + SQLAlchemy 2.0 async + PostgreSQL |
| Pipeline | Pillow · colorthief · imagehash · httpx |
| Busca | Brave Search API (pluggável: serpapi, google, mock) |
| Frontend | React 19 + Vite + Tailwind v4 + TanStack Query |
| Infra | Docker Compose · Cloudflare Tunnel · ZimaOS · GHCR |
| Auth | fastapi-users · JWT httpOnly · CSRF double-submit · convites |

### Features ativas

- Busca assíncrona por artista (background task, status polling)
- Download e processamento: `original`, `large` (2000px), `thumb` (400px)
- Paleta de cores dominantes (colorthief, 5 cores)
- Deduplicação por perceptual hash (phash)
- Cache: artista já buscado não rebate na API externa
- Galeria masonry responsiva (2–4 colunas)
- Lightbox com zoom pinch, swipe, navegação por teclado
- Upload manual de imagens por artista
- Coleções pessoais com add/remove de obras
- Moodboard: drag & drop livre, resize, z-index, export PNG
- Explorar: grid de todo o acervo com filtro por paleta de cores
- Pin de obras (destacar no topo da galeria)
- Ordenação do acervo: Recentes / A-Z
- Painel Admin: convites, papéis (admin/member), ativação de contas
- Sugestão de ortografia ao buscar artista desconhecido
- Registro fechado por convite

---

## 2. Sugestões de Features

Ordenadas por impacto estimado vs complexidade de implementação.

---

### 2.1 Tags e categorias nas obras ⭐ alto impacto, baixa complexidade

Atualmente uma obra pertence a um artista — e opcionalmente a coleções. Adicionar uma tabela `Tag` (many-to-many com `Artwork`) permitiria:

- Filtrar obras por estilo: "expressionismo", "retratos", "anos 1920"
- Cruzar artistas diferentes numa mesma tag
- Substituir parte do trabalho manual de coleções

**Implementação sugerida:** tabela `artwork_tags`, endpoint `PATCH /artworks/{id}/tags`, chips de tag no card e no lightbox. Tags globais visíveis na página Explorar como filtro paralelo ao de cor.

---

### 2.2 Notificação quando busca termina ⭐ alto impacto, baixa complexidade

A busca é assíncrona, mas o usuário não sabe que terminou se estiver em outra aba. Hoje o frontend faz polling com `refetchInterval`. Melhorar com:

- **Toast de conclusão** quando `sync_status` muda de `processing` → `ready`
- Opcionalmente: Web Push Notification (requer service worker — maior esforço)

O polling já existe; basta reagir ao primeiro `sync_status === 'ready'` com um toast.

---

### 2.3 Busca full-text no acervo ⭐ alto impacto, média complexidade

Hoje a única forma de encontrar uma obra específica é saber o artista e navegar visualmente. Adicionar uma barra de busca global (`GET /api/artworks/search?q=...`) sobre `title` e `artist.canonical_name` (usando `ILIKE` ou `pg_trgm`) permitiria encontrar obras pelo título.

---

### 2.4 Compartilhamento público de coleção (read-only) ⭐ médio impacto, média complexidade

Gerar um token opaco único (`share_token` na tabela `Collection`) que permite visualizar uma coleção sem login. Útil para enviar referências para colaboradores sem conta.

**Cuidado de segurança:** o share link deve ser revogável e não indexável (sem robots.txt + `noindex` no head).

---

### 2.5 Progresso de download em tempo real ⭐ médio impacto, alta complexidade

Hoje o status é binário: `processing` ou `ready`. Adicionar `progress` (ex: `{"downloaded": 12, "total": 30}`) ao modelo `Artist` e expor via SSE ou polling granular daria feedback visual mais rico ("12 de 30 imagens").

---

### 2.6 Filtros na galeria do artista (cor, período, pinned) médio impacto, baixa complexidade

A página de artista já tem a paleta de cores por obra. Adicionar chips de filtro local (client-side, sem nova query) por:

- Cor dominante (igual ao Explorar, mas escoped ao artista)
- Apenas obras fixadas
- Ordenação: mais recentes, mais antigas, por largura

---

### 2.7 Notas/anotações por obra médio impacto, baixa complexidade

O modelo `CollectionItem` já tem um campo `note`. Expor isso também na galeria do artista como uma nota global da obra (campo `note` em `Artwork`) tornaria possível anotar diretamente no card sem precisar adicionar a uma coleção.

---

### 2.8 PWA — instalação no celular médio impacto, baixíssima complexidade

Adicionar `manifest.json` com `name`, `icons`, `display: standalone`, `theme_color` ao Vite config transforma o app num PWA instalável. Não requer service worker para funcionar como ícone na home screen.

---

### 2.9 Export de coleção como PDF ou ZIP baixo impacto, média complexidade

O moodboard já tem export PNG. Adicionar:
- **ZIP** das imagens `large` de uma coleção via `GET /api/collections/{id}/export`
- **PDF board** com layout do moodboard (requereria biblioteca server-side: `weasyprint` ou similar)

---

### 2.10 Histórico de buscas / "Pesquisado recentemente" baixo impacto, baixíssima complexidade

Armazenar no `localStorage` as últimas N buscas (`artist name + slug`) e exibi-las como chips abaixo da barra de busca antes de o usuário digitar. Zero infraestrutura backend.

---

### 2.11 Múltiplos providers em sequência (fallback) baixo impacto, média complexidade

Se o Brave API retornar poucos resultados para um artista menos famoso, tentar automaticamente o próximo provider configurado. Implementável no `SearchService` com uma lista de providers em ordem de prioridade.

---

### 2.12 Bio curta do artista (editável pelo admin) baixo impacto, baixa complexidade

Campo `bio_short: str | None` já existe no modelo `Artist` mas não há UI para editar. Adicionar um textarea editável na página do artista (só admin) e expor via `PATCH /api/artworks/artists/{slug}`.

---

## 3. Falhas de Segurança e Riscos

---

### 3.1 🔴 ALTO — SSRF via DNS Rebinding (TOCTOU)

**Arquivo:** `backend/src/common/url_validator.py`

A função `validate_external_url` resolve o hostname com `socket.gethostbyname()` para verificar se o IP é privado, mas a requisição HTTP efetiva acontece depois com `httpx.AsyncClient.get()` — uma **segunda resolução de DNS**. Um servidor DNS malicioso pode responder com um IP público na validação e um IP privado (ex: `192.168.1.1`) na requisição real.

```python
# Validação: DNS resolve para 1.2.3.4 (público) ✓
resolved_ip = socket.gethostbyname(hostname)  # tempo T1
# ...
# Requisição real: DNS agora resolve para 192.168.1.1 (interno) ← SSRF
await client.get(image_url)  # tempo T2
```

**Mitigação recomendada:** Usar um HTTP client que impeça redirecionamentos para IPs privados, ou validar o IP **depois** da resolução feita pelo próprio httpx via `transport` customizado com verificação pós-conexão. Uma alternativa prática é usar o `httpx` com `transport=httpx.HTTPTransport(socket_options=...)` e verificar o IP real no nível do socket.

---

### 3.2 🔴 ALTO — Imagens servidas sem autenticação

**Arquivo:** `backend/src/main.py`, linha `app.mount("/images", StaticFiles(...))`

O endpoint `/images/...` serve arquivos estáticos **sem qualquer verificação de autenticação**. Qualquer pessoa com a URL direta de uma imagem pode acessá-la, mesmo sem conta no sistema.

Para uso pessoal atrás de Cloudflare Tunnel isso é aceitável, mas se o app ficar exposto publicamente (acidente de configuração, IP direto), todo o acervo fica acessível.

**Mitigação:** Adicionar um middleware ou rota autenticada que sirva as imagens via `FileResponse` com `Depends(current_active_user)`, ou usar signed URLs temporárias.

---

### 3.3 🟡 MÉDIO — ProxyHeadersMiddleware com `trusted_hosts="*"`

**Arquivo:** `backend/src/main.py`

```python
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
```

Isso faz o app confiar em qualquer valor de `X-Forwarded-For`. Um cliente malicioso pode forjar seu IP para contornar o rate limiting (`5 req/5min` por IP).

**Mitigação:** Restringir para o IP do Cloudflare Tunnel ou do proxy reverso. Se usando Cloudflare, configurar `trusted_hosts` para os [ranges de IP da Cloudflare](https://www.cloudflare.com/ips/).

---

### 3.4 🟡 MÉDIO — Sem Content-Security-Policy (CSP)

Nenhum cabeçalho CSP é enviado. Embora o app não tenha XSS conhecidos hoje, a ausência de CSP torna qualquer vulnerabilidade futura (ex: título de obra com HTML injetado) muito mais grave.

**Mitigação:** Adicionar middleware no FastAPI que injete:
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:; script-src 'self' 'nonce-...'
```

---

### 3.5 🟡 MÉDIO — Sem limite de quota por usuário (artistas, coleções, uploads)

Não há limite de:
- Quantos artistas um usuário pode criar/buscar
- Quantas coleções pode criar
- Quantos uploads pode fazer

Um usuário mal-intencionado (ou um convite vazado) pode causar:
- Esgotamento da quota da Brave API (2000 req/mês)
- Preenchimento do disco com imagens (`/app/data/images`)

**Mitigação:** Adicionar quotas configuráveis por papel: `MAX_ARTISTS_PER_USER`, `MAX_UPLOADS_MB_PER_USER`, e a tabela `auth/quotas.py` (que já existe mas está vazia).

---

### 3.6 🟡 MÉDIO — Validação de tipo de arquivo no upload confia no Content-Type do cliente

**Arquivo:** `backend/src/artworks/router.py`

```python
if not file.content_type.startswith("image/"):
    continue
```

`Content-Type` é enviado pelo cliente e pode ser forjado. Um arquivo `.html` ou `.svg` com `Content-Type: image/png` passa pela verificação inicial. O Pillow vai rejeitar na abertura, mas um SVG (que é XML) pode abrir em alguns contextos.

**Mitigação:** Usar `imghdr` ou `python-magic` para validar o magic bytes do arquivo independente do `Content-Type`.

---

### 3.7 🟡 MÉDIO — Links externos não sanitizados como href

**Arquivo:** `frontend/src/components/Lightbox.tsx`

`source_page_url` é armazenado diretamente da API de busca e renderizado como `href` no lightbox sem validação de esquema:

```tsx
<a href={artwork.source_page_url} ...>Ver fonte original</a>
```

Se uma URL `javascript:alert(1)` fosse armazenada (vinda de um provider), o link executaria JavaScript ao clicar.

**Mitigação:** Sanitizar no frontend antes de usar como `href`:
```typescript
const safeUrl = url?.startsWith('http') ? url : undefined
```
Ou validar o esquema no backend ao persistir `source_page_url`.

---

### 3.8 🟢 BAIXO — JWT sem rotação / sem revogação

JWTs têm validade de 7 dias sem refresh token e sem mecanismo de revogação imediata (blacklist). Se um token for comprometido, permanece válido por até 7 dias.

**Mitigação para V2:** Implementar refresh tokens de curta duração (1h) + long-lived refresh token (7d) com blacklist em Redis, ou adicionar um campo `token_version` no User que pode ser incrementado para invalidar todos os tokens do usuário.

---

### 3.9 🟢 BAIXO — FIRST_ADMIN_PASSWORD fraca por padrão

O `.env.example` tem `FIRST_ADMIN_PASSWORD=admin123`. Não há validação de força de senha para o admin bootstrap (diferente do `JWT_SECRET` que tem validação robusta).

**Mitigação:** Adicionar um validator em `Settings` que rejeite senhas com menos de 12 caracteres quando `ENVIRONMENT=production`.

---

### 3.10 🟢 BAIXO — Ausência de `Referrer-Policy` e `X-Content-Type-Options`

Cabeçalhos de segurança HTTP ausentes:
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — controla vazamento de URL
- `X-Frame-Options: DENY` — previne clickjacking

**Mitigação:** Adicionar um middleware de cabeçalhos de segurança (ex: `starlette-security-headers` ou implementação manual).

---

## 4. Priorização sugerida

### Imediato (antes de qualquer acesso público fora do Cloudflare Tunnel)
- 3.2 — Autenticar servimento de imagens
- 3.3 — Restringir `trusted_hosts` para IPs do Cloudflare
- 3.7 — Sanitizar `source_page_url` no frontend

### Próximas features de maior valor
1. Tags nas obras (2.1)
2. Notificação de busca concluída (2.2)
3. Busca full-text no acervo (2.3)
4. Filtros na galeria do artista (2.6)

### Para V2 (quando relevante)
- Compartilhamento público de coleção (2.4)
- Progresso granular de download (2.5)
- Rotação de JWT (3.8)
- CSP completo (3.4)
