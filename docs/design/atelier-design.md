# Atelier — Design System (único)

**Fonte canônica de UI** do Art-Catalog. Leia só este arquivo antes de implementar `frontend/**`.

Fusão deliberada de *Dark Botanical* (tema escuro premium) + *Estilo Suíço Artístico* (galeria estruturada), adaptada ao PRD §10. **Não existem outras specs de design neste repo.**

Convenções de código: [`../conventions/frontend.md`](../conventions/frontend.md).

---

## 1. Princípios

| Regra | Detalhe |
|---|---|
| Art-first | A obra é protagonista; UI recua |
| Sempre dark | Fundo `#0f0f0f`; **nunca** página em branco `#FFFFFF` |
| Tipografia editorial | Cormorant (display) + IBM Plex Sans (UI/corpo) |
| Galeria suíça no dark | Grid arejado, whitespace, metadados no hover, stagger na entrada |
| Paleta da obra | Barra de cores nos cards = `dominant_colors` da API (não tokens fixos) |
| Proibido | Paleta verde/âmbar MeioOrc; Inter/Roboto/Arial; emojis na UI; gradientes decorativos competindo com imagens |

**Atmosfera:** elegante, sofisticado, galeria de arte contemporânea. Density 5/10, motion 4/10 (sutil).

---

## 2. Tokens (implementação)

Definir em `frontend/src/index.css` e espelhar em `tailwind.config.ts`:

```css
:root {
  /* Superfícies */
  --background: 15 15 15;              /* #0f0f0f deep black */
  --foreground: 232 228 223;           /* #e8e4df warm text */
  --muted-foreground: 154 149 144;     /* #9a9590 */
  --card: 20 20 20;                    /* leve elevação sobre bg */
  --border: 154 149 144;               /* usar com opacity ~25% */

  /* Acentos (CTA, decoração, estados) */
  --accent: 212 165 116;               /* #d4a574 warm */
  --accent-pink: 232 180 184;          /* #e8b4b8 */
  --accent-gold: 201 184 150;          /* #c9b896 */
  --accent-terracotta: 196 133 106;    /* #c4856a */

  /* Semânticos (derivados dos acentos, saturação ≤ 80%) */
  --destructive: 128 0 32;             /* borgonha suave #800020 */
  --success: 107 142 35;               /* oliva #6B8E23 */
  --warning: 204 119 34;               /* ocre #CC7722 */

  /* Tipografia & forma */
  --font-display: "Cormorant", Georgia, serif;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --radius: 0.5rem;
  --letter-spacing-ui: 0.02em;

  /* Motion */
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-entry: 420ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

**Google Fonts:** Cormorant (400, 400 italic, 600, 700) · IBM Plex Sans (300, 400, 500) · JetBrains Mono (400).

**Formas abstratas (opcional, discretas):** círculos com `border-radius: 50%`, `filter: blur(60px)`, `opacity: 0.3`, cores warm/pink/gold — só em auth ou hero de busca, nunca atrás da galeria.

**Linha vertical decorativa:** `width: 1px; height: 80px; background: var(--accent)`.

---

## 3. Tipografia

| Papel | Família | Uso |
|---|---|---|
| Display / Hero | Cormorant 700 | Título da app, nome do artista |
| Assinatura | Cormorant 400 italic | Subtítulos decorativos (ex.: "Atelier") |
| Corpo | IBM Plex Sans 400 | Parágrafos, descrições |
| UI / labels | IBM Plex Sans 500 | Botões, nav, captions `0.875rem`, `letter-spacing: 0.02em` |
| Metadados | JetBrains Mono 400 | Dimensões, debug |

**Escala:**

- Hero: `clamp(2.5rem, 5vw, 4rem)`
- H1: `2.25rem` · H2: `1.5rem`
- Body: `1rem / 1.6`, máx `72ch` por linha
- Small: `0.875rem`

---

## 4. Componentes

### Botões
- **Primário:** `border-radius: var(--radius)` (0.5rem, **não** pill). Fill `--accent`. Hover: escurecer 8% + sombra leve. Active: `translateY(-1px)`. Weight 600. Sem glow.
- **Secundário / ghost:** borda `1.5px` muted; hover com fill sutil.

### Cards (obra na galeria)
- `border-radius: var(--radius)`, fundo `--card`, borda `1px` muted, sombra `0 2px 12px rgba(0,0,0,0.06)` (máx `0 2px 8px rgba(0,0,0,0.08)`).
- **Barra de paleta:** faixa fina no rodapé do card com as 5 cores de `dominant_colors`.

### Inputs
- Label acima (sem floating label). Borda `1px`. Focus: ring `2px` accent, offset `2px`. Erro abaixo em destructive.

### Navegação
- Fundo `--background`. Item ativo: indicador `--accent`, weight 500.

### Loading
- Skeleton shimmer nas dimensões do card — **sem** spinner circular.

### Empty states
- Ícone Lucide + texto em português + botão de ação.

---

## 5. Layout global

- **Container:** `max-width: 1280px`, centralizado, padding lateral `1.5rem`.
- **Ritmo:** unidade base `0.5rem` (8px). Gaps verticais entre seções: `clamp(4rem, 8vw, 8rem)`.
- **Mobile:** colunas colapsam abaixo de `768px`; sem overflow horizontal.
- **Altura:** `min-h-[100dvh]` — nunca `h-screen`.
- **z-index:** base `0` · sticky-nav `100` · overlay/lightbox `200` · modal `300` · toast `500`.

---

## 6. Superfícies do produto

### Login / Register
- Mesmo tema dark. Formas abstratas CSS opcionais e **discretas**.
- Formulário centralizado; sem competir visualmente com obras (ainda não há galeria).

### Search (`/`)
- Campo de busca centralizado (hero assimétrico leve).
- **Loading explícito** enquanto o backend baixa imagens (PRD).
- Lista de artistas já buscados (cache) com mesma tipografia e motion de lista.

### Gallery (masonry)
- **CSS columns** (sem lib extra) — padrão suíço de grid para arte.
- Colunas responsivas: **2** (mobile) → **3** (tablet) → **4** (desktop).
- Whitespace generoso entre cards; imagem em alta resolução (thumb na grade).
- **Hover:** overlay sutil com título da obra (micro-interação suíça).
- **Entrada:** fade + `translateY(16px → 0)` em `420ms`, stagger **80ms** entre cards.
- Reveal escalonado no primeiro load da grade.

### Lightbox
- Overlay `--background` ~95% opacidade.
- Imagem versão `large`; título, dimensões, link da fonte.
- Fechar: `Esc`, clique no backdrop, gestos touch no mobile (PRD).
- Transição de abertura: fade `200ms`.

### Barra de paleta (card)
- Cores **somente** de `dominant_colors` retornado pela API — nunca inventar.

---

## 7. Motion

| Tipo | Spec |
|---|---|
| Padrão | ease-out, `200–300ms` |
| Entrada de lista | fade + translateY 16px, `420ms`, stagger 80ms |
| Hover | cor/sombra, `200ms` |
| Troca de página | fade `200ms` |
| Performance | animar **só** `transform` e `opacity` |

---

## 8. Anti-padrões (proibido)

- Fundo branco `#FFFFFF` ou tema claro em qualquer página
- Paleta MeioOrc (verde/âmbar)
- Inter, Roboto, Arial, Avenir como fontes principais
- Emojis na UI (usar Lucide)
- Gradientes decorativos pesados atrás das obras
- Sombras > `0 2px 8px rgba(0,0,0,0.08)`
- Layouts de 3 colunas iguais para features (preferir assimétrico)
- `h-screen`
- Copy em inglês tipo "Elevate", "Seamless", "Unleash", "Next-Gen"
- Placeholders de imagem externos quebrados em produção
- Lorem ipsum em demos
- `#000000` puro em texto — usar `#0f0f0f` / warm text

---

## 9. Checklist de implementação (Fase 3)

```
- [ ] Tokens CSS + Tailwind configurados
- [ ] Fontes Google carregadas (Cormorant, IBM Plex Sans, JetBrains Mono)
- [ ] Tema dark em todas as rotas (auth + app)
- [ ] Gallery masonry 2/3/4 colunas + stagger
- [ ] Card com thumb + barra dominant_colors
- [ ] Hover com metadados da obra
- [ ] Lightbox (large, Esc, backdrop, touch)
- [ ] Loading explícito na busca
- [ ] Skeletons (sem spinner circular)
- [ ] Copy em português
- [ ] Sem paleta MeioOrc
```

---

## 10. Prompt rápido (IA)

Design a dark, premium art-reference gallery app (Atelier). Deep black background `#0f0f0f`, warm text `#e8e4df`. Cormorant serif for display, IBM Plex Sans for UI. Subtle warm accents (gold, terracotta, pink) and optional blurred abstract CSS circles only on auth/search shell. Masonry gallery with generous whitespace, artwork color bars from API data, staggered fade-in, hover metadata overlay, dark lightbox. Swiss-style structured grid on dark — never a white page. No MeioOrc green/amber. Portuguese UI copy.
