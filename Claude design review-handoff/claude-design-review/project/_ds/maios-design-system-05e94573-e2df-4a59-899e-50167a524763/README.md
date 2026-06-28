# Maios Design System

Brand + component system for **Maios** — a premium German e‑commerce store (maiosshop.com) selling smart gadgets and aesthetic lifestyle products. This system captures the storefront's flagship identity: a **dark, neon‑premium** look — near‑black surfaces, a violet/cyan/pink glow, frosted glass, and big geometric display type.

> **Design direction note.** The live codebase actually runs *two* visual systems: the premium Tailwind landing page (`index.html`) and older Bootstrap product/cart pages. The product team's own `CLAUDE-DESIGN.md` flags this as a brand break and recommends consolidating onto the premium look. **This design system standardizes on that premium dark/neon identity** — so building with it pulls the whole brand toward the intended direction.

---

## Sources used to build this system

Everything here was reverse‑engineered from the real product. If you have access, explore these to go deeper:

- **Codebase (primary source of truth):** the attached `Maios/` repository — `index.html` (Tailwind theme config + hero), `produkte/*.html` (product pages), `cart.*`, `styles.css`, and `Marketing/products.json` (catalog).
- **GitHub mirror:** <https://github.com/Nevio83/test2> — same codebase. Useful files: `CLAUDE-DESIGN.md` (UI/UX + design‑system audit), `CLAUDE.md` (architecture), `README.md`. Browse it to better understand the product before building large surfaces.
- **Logo asset:** `Maios/images/logo.jpg` → copied to `assets/logo.jpg`.

No Figma was provided. Fonts (Inter + Outfit) are the brand's own Google Fonts choices — **no substitution was needed**.

---

## How to use

Consumers link **one** file:

```html
<link rel="stylesheet" href="styles.css">
<!-- Bootstrap Icons power every `icon` prop / `bi-*` glyph -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
```

`styles.css` is an `@import` manifest only. It pulls in the token files, the font import, the base utilities, and the component CSS. Put `class="maios-dark"` on a wrapper (or `<body>`) to get the near‑black stage + base typography.

React primitives are bundled to `window.MaiosDesignSystem_05e945`:

```js
const { Button, ProductCard, Badge } = window.MaiosDesignSystem_05e945;
```

---

## CONTENT FUNDAMENTALS — how Maios writes

The voice is **bilingual by zone**, and that split is intentional:

- **Brand / editorial surfaces speak English, aspirational and minimal.** Hero and vision copy: "Redefine Living.", "Discover a curated selection of smart technology and aesthetic home essentials.", "Design meets Function.", "Curated For You", "Our Philosophy". Short. Confident. Lifestyle‑led, not spec‑led.
- **Shop / transactional surfaces speak German.** Product names, descriptions, CTAs and system messages: "In den Warenkorb", "Jetzt kaufen", "Unsere Bestseller", "Alle Produkte", "Kostenloser Versand in Europa", "30 Tage Rückgaberecht", "Auf Lager", "7–13 Werktage".
- **Tone:** premium but friendly; benefit‑first. Marketing hooks in `products.json` are playful and first‑person ("Mein Post‑Workout Drink passt jetzt in die Handtasche").
- **Du vs. Sie:** the live shop mixes both (search says "Wonach suchst du?" / Du, while category subtitles use "Entdecken Sie…" / Sie). **Recommendation: standardize on _Du_** — it fits the young, lifestyle audience and the English brand voice. Pick one and hold it.
- **Casing:** display headlines are sentence case with a hard period as punctuation‑as‑style ("Redefine Living.", "Function."). Eyebrows/labels are UPPERCASE with wide tracking ("NEW COLLECTION DROPPED", "SCROLL"). Avoid Title Case.
- **Currency & numbers:** Euro, symbol‑first, two decimals — `€28.99`. Discounts shown as struck original + price; "−59%" style pills. Shipping times as ranges ("7–13 Werktage").
- **Emoji:** not used in the premium UI. (They appear in internal Markdown docs only — keep them out of customer‑facing surfaces.)

---

## VISUAL FOUNDATIONS

**Color.** The system sits on a near‑black, cool‑neutral surface ramp (`#020202` footer → `#030304` base → `#0A0A0B` surface → `#141415` elevated). The brand is carried by a **neon trio**: Vivid Violet `#8B5CF6` (primary), Electric Cyan `#22D3EE` (secondary), Hot Pink `#F472B6` (accent). Text is white → cool grays (`#9CA3AF` secondary, `#6B7280` muted). Status: emerald `#10B981` / neon‑green `#43E97B` in‑stock dot, danger `#EF4444`, sale gold `#FFD700`. Each storefront category owns a hue (Technik green, Beleuchtung gold, Wellness purple, Küche pink). Prefer brand colors; if you need an in‑between, derive it in OKLCH from the trio rather than inventing a new hue.

**Type.** Two Google families. **Outfit** (geometric) for display — extra‑bold (800), tight tracking (−0.05em), ultra‑tight leading (0.9) on hero. **Inter** (humanist) for body/UI — often light (300) at large sizes, relaxed 1.6 leading. Eyebrows are uppercase Inter with 0.05em (labels) to 0.3em (micro) tracking. The hero gradient‑clips "Living." in the violet→cyan accent.

**Backgrounds.** Flat near‑black, never pure white in brand zones. Depth comes from large, soft, blurred color orbs (violet + cyan, ~120px blur, floating) behind a radial `--gradient-hero`, plus a subtle noise texture. No photographic full‑bleeds in chrome; imagery lives inside product cards. Product photography is **moody, ambient, lifestyle** (often multi‑shot collages with colored lighting) — it reads warm/saturated and sits naturally on dark cards via `object-fit: cover`.

**Glass & blur.** The signature surface is frosted glass: `rgba(255,255,255,0.02)` fill + 16px backdrop blur + a 1px `rgba(255,255,255,0.05)` border (`.maios-glass`). The nav is a stronger glass (`rgba(3,3,4,0.7)` + 20px blur). Use blur for overlays, nav, dropdowns and bento tiles — not for everything.

**Shadows / glow.** Two shadow families. **Neon glow** = colored halo with no offset (`0 0 30px rgba(139,92,246,.15)`, stronger on hover/CTAs, cyan variant for secondary). **Depth** = soft black drop (`0 8px 32px rgba(0,0,0,.37)`). Display headlines get a soft text glow (`0 0 60px rgba(139,92,246,.3)`). White CTAs carry a violet glow that shifts cyan on hover.

**Borders & radii.** Borders are hairline white‑alpha (`0.05` subtle → `0.1` default → `0.2` strong), never hard gray. Radii climb from 8px chips → 12px inputs → 16px cards/dropdowns → 24px product cards → **32px bento/glass** → fully‑round pills (buttons, icon buttons, badges, swatches). Pills are the brand's default button shape.

**Cards.** Two archetypes: (1) **GlassCard / bento** — frosted, 32px radius, dashed border for empty states, lifts fill+border on hover; (2) **ProductCard** — glass tile, 24px radius, square media well, the image zooms 1.05× and the card lifts 4px with a depth shadow on hover.

**Motion.** Calm and physical. Hero orbs `float` (6s ease‑in‑out, ±20px Y, offset delays). Content reveals via `slide‑up` (0.8s ease‑out, 30px). Standard easing `cubic-bezier(.4,0,.2,1)`; durations 0.2 / 0.3 / 0.6s. No bounces, no spin, no infinite loops on content. All brand animations respect `prefers-reduced-motion`.

**Interaction states.** Hover: secondary text white‑ens; ghost/icon buttons gain `white-a05`; CTAs intensify glow + lift 1px; cards lift + zoom image. Press: icon buttons scale to 0.94. Focus: 2px violet `:focus-visible` ring with offset (critical on dark). Selected: swatches get a white double‑ring; tabs fill with the accent gradient.

**Layout.** Centered `max-w-7xl` (1280px) with `px-6` (24px) gutters; 80px sticky glass nav; sections breathe at 96–128px vertical. Use flex/grid with `gap`, not margins.

---

## ICONOGRAPHY

- **System:** **Bootstrap Icons 1.11.3**, loaded from CDN (`bootstrap-icons.min.css`). This is the brand's real icon set — every component `icon` prop expects a `bi-*` class. Load the CSS wherever you use components or `bi` glyphs.
- **Style:** outline/duotone‑free, rounded, ~1.5px stroke feel; sizes 16–24px in UI, up to 56px as decorative section marks (e.g. `bi-quote`).
- **Common glyphs:** `bi-bag` / `bi-bag-plus` (cart), `bi-heart` / `bi-heart-fill` (wishlist), `bi-search`, `bi-list` (menu), `bi-x`, `bi-chevron-left/right`, `bi-arrow-right`, `bi-truck`, `bi-shield-check`, `bi-arrow-return-left`, `bi-airplane`, `bi-stars`. Category glyphs: Technik `bi-cpu`, Beleuchtung `bi-lightbulb`, Wellness `bi-heart-pulse`, Küche `bi-house`, All `bi-grid-3x3-gap`.
- **Payment marks:** real logos copied to `assets/payment/` (`visa`, `mastercard`, `paypal`, `klarna`, `google-pay`, `giropay`). Use these PNG/JPG marks for trust rows — do not redraw them.
- **Logo:** `assets/logo.jpg` is a serif "M" monogram + "Maios" wordmark, white on black. In‑product the brand also renders a text wordmark "MAIOS" in Outfit 900 with a trailing violet pulse dot (nav) or a period accent (footer). On light backgrounds, invert the monogram.
- **Emoji / Unicode:** not used as UI icons in customer‑facing surfaces.

---

## INDEX — what's in this folder

**Foundations (CSS)**
- `styles.css` — the entry manifest consumers link (imports only).
- `tokens/colors.css` · `typography.css` · `spacing.css` · `effects.css` · `fonts.css` — design tokens (131 of them).
- `base.css` — brand utility classes: `.maios-dark`, `.maios-glass`, `.maios-glass-nav`, `.maios-text-gradient`, `.maios-neon-text`, `.maios-display`, `.maios-eyebrow`.
- `components/components.css` — class styling for the React primitives.

**Components** (`components/<group>/<Name>.jsx` + `.d.ts` + `.prompt.md`, mounted from `window.MaiosDesignSystem_05e945`)
- `actions/` — **Button** (5 variants × 3 sizes), **IconButton** (with count bubble).
- `feedback/` — **Badge** (status/eyebrow pills), **PriceTag** (sale‑aware EUR pricing).
- `surfaces/` — **GlassCard** (frosted bento), **ProductCard** (catalog tile).
- `forms/` — **Input** (dark pill, optional icon), **ColorSwatch** (accessible variant picker).
- `navigation/` — **CategoryTab** (gradient‑fill filter tab).

**Specimen cards** (`guidelines/*.html`) — 18 small `@dsCard`s across Colors, Type, Spacing, Effects, Brand. These render in the Design System tab.

**UI kit** (`ui_kits/storefront/`) — high‑fidelity recreation of the storefront (Home hero + bento, category listing, product detail, cart). Composes the primitives above. Catalog sample in `data.js` mirrors `Marketing/products.json`. *(In progress — see project todos.)*

**Skill** — `SKILL.md` makes this folder usable as a downloadable Claude Agent Skill.

---

## Maintainers

The compiler auto‑generates `_ds_bundle.js`, `_ds_manifest.json`, and `_adherence.oxlintrc.json` — never edit those by hand. After changing sources, run `check_design_system` and fix what it reports.
