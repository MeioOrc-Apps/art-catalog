# Convenções de teste

## Cobertura mínima

| Camada | Cobertura | Ferramenta |
|---|---|---|
| Backend | ≥ 85% linhas | `pytest --cov=src --cov-report=term-missing` |
| Frontend | ≥ 70% linhas | `vitest run --coverage` |

## Política

- Cobertura medida no CI; PRs abaixo do threshold são bloqueados (a partir da Fase 2).
- E2E cobre apenas fluxos críticos: auth, busca→galeria→lightbox, coleções.
- HTTP externo nunca é chamado nos testes unitários — usar `respx` (backend) e `msw` (frontend).

## Backend (pytest)

- `pytest-asyncio` com `asyncio_mode=auto`.
- Fixtures globais em `backend/tests/conftest.py`: `app`, `async_client`, `db_session`, `tmp_images_dir`.
- HTTP externo sempre mockado com `respx`.
- Cobertura: `pytest --cov=src --cov-report=term-missing`.

## Frontend (vitest + RTL)

- `vitest run --coverage` no CI.
- Mock de API com MSW (handlers reaproveitados entre testes).
- Sem testes de implementação interna; testar comportamento de usuário.

## E2E (Playwright)

- Fluxos críticos apenas.
- Marcas: `@smoke` (Fase 0), `@external` (provider real Fase 4).
