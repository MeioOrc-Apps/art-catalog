---
name: save-state-foundation
description: Copia e adapta a fundação do projeto Save State (auth com fastapi-users, JWT em cookie httpOnly, convites por código, CSRF double-submit, rate limit, roles admin/member, docker-compose, Nginx, GitHub Actions) para o Art-Catalog. Use ao executar a Fase 1 do roadmap, ao implementar autenticação, sistema de convites, CSRF ou ao montar a base de infraestrutura do projeto.
---

# Save State Foundation — Copy & Adapt

A fundação do Art-Catalog **não é escrita do zero**. Ela é copiada do projeto Save State e adaptada apenas no que muda (nome do cookie, domínio, env vars, nomes de classes/labels).

## Localização do código fonte

```
/Users/sergio.sousa/Projects/person/my-apps/save-state
```

Trate este caminho como **read-only**. Leia, mas nunca edite.

## O que copiar

Da árvore do Save State, traga para `art-catalog/`:

| De | Para | O que é |
|---|---|---|
| `backend/src/auth/` | `backend/src/auth/` | fastapi-users (models, schemas, users, router, manager) |
| `backend/src/core/security.py` | `backend/src/core/security.py` | middleware CSRF double-submit |
| `backend/src/core/rate_limit.py` | `backend/src/core/rate_limit.py` | rate limit das rotas `/auth` |
| `backend/src/core/config.py` | `backend/src/core/config.py` | pydantic-settings (adaptar campos) |
| `backend/src/core/database.py` | `backend/src/core/database.py` | engine async + `Base` + dep `get_session` |
| `backend/Dockerfile`, `docker-compose.yml`, `.env.example` | raiz/`backend/` | infra base |
| `frontend/src/lib/api.ts` | idem | fetch client com `credentials: 'include'` + eco do CSRF |
| `frontend/src/auth/` | idem | `AuthContext` + `ProtectedRoute` |
| `frontend/src/pages/Login.tsx`, `Register.tsx` | idem | páginas (registro por convite) |
| `.github/workflows/` | idem | CI/CD |

## O que adaptar (somente isso)

1. **Nome do cookie de auth:** `save_state_auth` → `artref_auth`.
2. **`COOKIE_DOMAIN`:** valor de produção → `.meioorc.com` (já é o mesmo, confirmar).
3. **Variáveis de ambiente** que mencionem o nome do app:
   - `APP_NAME=Atelier`
   - `DATABASE_URL=postgresql+asyncpg://art:art@db:5432/art`
   - `FIRST_ADMIN_EMAIL=sergio@meioorc.com`
4. **Strings de UI** das páginas de login/registro: trocar branding "Save State" por "Atelier".
5. **Paleta visual** do login/registro: **não** usar verde/âmbar do MeioOrc — usar a estética escura e neutra do Art-Catalog (ver `.cursor/rules/200-frontend.mdc`).
6. **Nome do banco no docker-compose:** `art` (não `save_state`).

## O que NÃO adaptar

- A lógica de auth, geração de convite, validação de CSRF, rate limit — **manter idêntica**.
- A estrutura de pastas dentro de `auth/`.
- Os nomes das rotas (`/auth/login`, `/auth/register-with-invite`, `/auth/invites`, etc.).
- A escolha de bcrypt, JWT, `SameSite=Lax`, `Secure` em produção.

## Workflow

```
- [ ] 1. Listar arquivos do Save State a copiar (rodar `ls` em /Users/sergio.sousa/Projects/person/my-apps/save-state)
- [ ] 2. Copiar para o Art-Catalog mantendo a mesma árvore relativa
- [ ] 3. Aplicar as 6 adaptações acima (e SÓ essas) — usar grep para auditar `save_state`, `save-state`, `Save State`
- [ ] 4. Atualizar `.env.example` com as vars do Art-Catalog
- [ ] 5. Rodar `docker compose up`; verificar que `db` + `api` sobem
- [ ] 6. DoD da Fase 1: criar admin via env, gerar convite, registrar member, login persistente, logout
```

## Auditoria final

Antes de fechar a fase, rodar:

```bash
rg -i "save[_-]?state" backend/ frontend/ docker-compose.yml .env.example
```

Qualquer match restante (fora de comentários explicativos) é bug.

## Pegadinhas conhecidas

- **CSRF em login:** `application/x-www-form-urlencoded` (fastapi-users), demais requests JSON. O middleware CSRF precisa ignorar `POST /auth/login` (já vem assim no Save State — não remover).
- **Cookie em desenvolvimento:** `COOKIE_SECURE=false` em dev (HTTP); `true` em produção (HTTPS). Não esquecer.
- **CORS:** em dev o Vite faz proxy de `/api` e `/images` — não habilitar CORS aberto na API.
