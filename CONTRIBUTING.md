# Contribuindo

## Regras

- Todo PR precisa ter testes.
- Rode `make test` (ou equivalente por camada: `pytest` + `vitest run`) antes de pedir review.
- Construir em fases (ver PRD §13). Um PR por fase.
- Teste primeiro, código depois — TDD obrigatório.

## Fluxo

1. Leia o PRD e o plano de implementação correspondente.
2. Crie branch: `fase/N-descricao`.
3. Implemente seguindo o contrato TDD do plano.
4. Abra PR com descrição do que foi feito e checklist DoD.
5. CI deve estar verde (lint + testes).
