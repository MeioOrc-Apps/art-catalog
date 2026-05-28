# Frontend — convenções

**Aplica-se a:** `frontend/**`

## Estética: art-first

**Design system (fonte canônica única):** [`docs/design/atelier-design.md`](../design/atelier-design.md)

- Tema dark premium (`#0f0f0f`), Cormorant + IBM Plex Sans, galeria masonry estilo suíço no dark.
- A obra é a protagonista. **NÃO** usar a paleta verde/âmbar do MeioOrc.
- Barra de paleta nos cards: cores de `dominant_colors` da API.
- Motion: reveal escalonado na galeria (80ms entre itens) — ver §7 do design system.

## Estrutura
```
frontend/src/
  lib/api.ts        cliente fetch: credentials:'include', echo do CSRF (cookie → header X-CSRF-Token)
  auth/             AuthContext + ProtectedRoute (padrão Save State)
  pages/            Login, Register (convite), Search (rota protegida /)
  components/       Gallery (masonry), Lightbox
```

## Regras
- Dados via TanStack Query; estado de loading explícito durante a busca (o backend baixa as imagens).
- `Gallery`: masonry com CSS columns (sem lib extra). Card = thumb + barra fina com a paleta
  de cores dominante. Reveal escalonado com `animation-delay` no load.
- `Lightbox`: abre a versão `large`; mostra título, dimensões e link da fonte; fecha no `Esc` e
  no clique no backdrop.
- Imagens vêm de `/images/{path}` (mesma origem; o Vite faz proxy de `/api` e `/images` para o backend em dev).
- Login usa `application/x-www-form-urlencoded` (fastapi-users); demais requests usam JSON.
- Não usar `localStorage` para token — o JWT vive em cookie httpOnly. Só ler o cookie CSRF
  (não-httpOnly) para ecoar no header.

## Build
- Vite + TS estrito. Produção: build estático servido por Nginx no mesmo container ou separado.
