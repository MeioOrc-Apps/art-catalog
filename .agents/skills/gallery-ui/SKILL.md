---
name: gallery-ui
description: Implementa a Fase 3 do Art-Catalog: página Search, Gallery masonry, Lightbox, loading de busca síncrona, lista de artistas em cache, refresh e mobile touch. Use ao trabalhar em frontend/src/pages/Search, components/Gallery ou Lightbox, ou ao integrar POST /api/artworks/search com TanStack Query.
---

# Gallery UI — Fase 3

**DoD (PRD §13):** buscar pela UI exibe o grid; clicar abre o lightbox; rebuscar usa cache; botão atualizar com `refresh: true`.

**Pré-requisitos:** Fase 2 com `POST /api/artworks/search`, `GET /api/artworks/artists`, `GET /api/artworks/artists/{slug}` funcionando com provider `mock`.

**Leia antes (não duplicar aqui):**

- Design visual: [`docs/design/atelier-design.md`](../../../docs/design/atelier-design.md)
- Código: [`docs/conventions/frontend.md`](../../../docs/conventions/frontend.md)
- Comportamento produto: PRD §9–10

---

## Escopo desta skill

| Inclui | Não inclui (outras fases/skills) |
|---|---|
| Página `Search`, `Gallery`, `Lightbox` | Login/Register → `save-state-foundation` |
| TanStack Query na busca e cache | Pipeline/backend → `image-pipeline` |
| Tokens CSS do design system | Coleções → Fase 4 |
| Lista lateral/histórico de artistas | Provider real → Fase 4 |

---

## Tipos (alinhar ao backend)

```ts
// frontend/src/types/artwork.ts
export type DominantColor = [number, number, number]

export interface Artwork {
  id: string
  title: string | null
  image_thumb: string
  image_large: string
  width: number | null
  height: number | null
  source_page_url: string | null
  dominant_colors: DominantColor[] | null
}

export interface Artist {
  id: string
  slug: string
  canonical_name: string
  artworks: Artwork[]
  last_searched_at: string | null
}

export interface SearchPayload {
  artist: string
  limit?: number
  refresh?: boolean
}
```

Ajustar campos ao schema real da API quando existir — estes são o contrato esperado pelo PRD.

---

## API client

Usar `lib/api.ts` (credentials + CSRF da Fase 1):

```ts
export async function searchArtworks(body: SearchPayload): Promise<Artist> {
  return apiJson('/api/artworks/search', { method: 'POST', body: JSON.stringify(body) })
}

export async function listArtists(): Promise<Pick<Artist, 'id' | 'slug' | 'canonical_name' | 'last_searched_at'>[]> {
  return apiJson('/api/artworks/artists')
}

export async function getArtist(slug: string): Promise<Artist> {
  return apiJson(`/api/artworks/artists/${slug}`)
}
```

URLs de imagem: `` `/images/${artwork.image_thumb}` `` (proxy Vite em dev).

---

## Página `Search` (`/`)

### Layout (ver atelier-design §6)

1. **Hero:** campo de busca centralizado + botão "Buscar" (submit).
2. **Sidebar ou seção abaixo:** artistas já buscados (`listArtists`).
3. **Área principal:** `Gallery` quando houver `Artist` ativo.

### TanStack Query

```ts
const searchMutation = useMutation({
  mutationFn: (vars: { artist: string; refresh?: boolean }) =>
    searchArtworks({ artist: vars.artist, refresh: vars.refresh }),
  onSuccess: (data) => {
    queryClient.setQueryData(['artist', data.slug], data)
    queryClient.invalidateQueries({ queryKey: ['artists'] })
    setActiveSlug(data.slug)
  },
})

const { data: cachedArtist } = useQuery({
  queryKey: ['artist', activeSlug],
  queryFn: () => getArtist(activeSlug!),
  enabled: !!activeSlug && !searchMutation.isPending,
})
```

### Estados obrigatórios

| Estado | UI |
|---|---|
| `searchMutation.isPending` | Skeleton cards ou barra de progresso + texto "Buscando e baixando obras…" |
| Sucesso | `Gallery` com `artist.artworks` |
| Erro | Mensagem em português + retry |
| Cache | Clicar artista na lista → `getArtist(slug)` sem `refresh` |
| Atualizar | Botão "Atualizar" → `searchMutation.mutate({ artist, refresh: true })` |

**Busca síncrona:** o loading cobre todo o tempo do POST (backend processa imagens). Não esconder loading cedo.

---

## `Gallery` (masonry)

### CSS columns (sem lib)

```css
.art-masonry {
  column-gap: 1rem;
  column-count: 2;
}
@media (min-width: 768px) { .art-masonry { column-count: 3; } }
@media (min-width: 1024px) { .art-masonry { column-count: 4; } }
.art-masonry-item {
  break-inside: avoid;
  margin-bottom: 1rem;
}
```

### `ArtworkCard`

- `<img src={/images/${thumb}} alt={title} loading="lazy" />`
- **Barra de paleta:** `dominant_colors.map(c => <span style={{ background: rgb(...) }} />)` — cores da API, não tokens fixos.
- Hover: overlay com título (opacity transition 200ms).
- Entrada: `animation-delay: ${index * 80}ms` + fade/translateY (atelier-design §7).
- `onClick` → abre `Lightbox` com índice.

### Skeleton

Shimmer retangular na proporção do card — **sem** spinner circular.

---

## `Lightbox`

- Estado: `open`, `index`, lista `artworks`.
- Imagem: `image_large`.
- Metadados: título, `{width}×{height}`, link externo `source_page_url` (nova aba).
- Fechar: `Esc`, clique backdrop, botão X.
- **Mobile:** swipe horizontal opcional (touchstart/touchend) ou setas; área de toque ≥ 44px.
- `z-index: 200` (overlay); animar só opacity/transform.
- Trap focus quando aberto (acessibilidade básica).

```tsx
useEffect(() => {
  if (!open) return
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [open, onClose])
```

---

## Design system (setup mínimo)

Antes dos componentes, configurar tokens de [`atelier-design.md`](../../../docs/design/atelier-design.md):

- `index.css`: variáveis CSS §2
- `tailwind.config.ts`: `colors`/`fontFamily` espelhando tokens
- Google Fonts: Cormorant + IBM Plex Sans
- `shadcn/ui` com tema dark custom (sem verde MeioOrc)

Não redefinir cores/tipografia nesta skill — só aplicar o doc.

---

## Rotas

```tsx
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
<Route element={<ProtectedRoute />}>
  <Route path="/" element={<Search />} />
</Route>
```

---

## Checklist DoD

```
- [ ] Tokens + fontes (atelier-design) aplicados
- [ ] Search: input + submit + loading explícito durante POST
- [ ] Lista de artistas (GET /artists) clicável → cache sem refresh
- [ ] Botão "Atualizar" envia refresh: true
- [ ] Gallery: masonry 2/3/4 colunas, stagger 80ms
- [ ] Card: thumb + barra dominant_colors + hover título
- [ ] Lightbox: large, metadados, Esc, backdrop, link fonte
- [ ] Mobile: grid 2 colunas; lightbox usável no touch
- [ ] Imagens via /images/... (proxy dev ok)
- [ ] Copy em português
- [ ] Teste manual: "Egon Schiele" mock → grid → lightbox → reabrir artista = cache
```

---

## Teste manual

1. Login como member.
2. Buscar `Egon Schiele` — aguardar loading até concluir.
3. Ver ≥ 1 card com barra de cores.
4. Clicar card → lightbox com imagem grande.
5. Voltar, clicar mesmo artista na lista → instantâneo (cache).
6. "Atualizar" → loading de novo, obras podem mudar.
7. Redimensionar janela: 2 → 3 → 4 colunas.

---

## Anti-padrões

- Spinner circular central (usar skeleton)
- `localStorage` para JWT
- Paleta MeioOrc ou Inter/Roboto
- Masonry via lib pesada (Masonry.js etc.) — CSS columns basta no MVP
- Esconder loading antes do POST terminar
- Placeholder picsum em produção
