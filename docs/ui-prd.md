# UI/UX PRD — ShelfLife Premium Redesign
## From functional to premium: a visual overhaul of the React storefront and admin

**Document type:** Design/Implementation PRD — hand to an AI coding agent as the single source of truth
**Scope:** `client/` only. Zero backend changes. Zero behavior changes.
**Status quo:** All flows work (browse → cart → coupon → checkout → pay → track → review; admin CRUD + analytics). Current UI is clean but generic: default Tailwind grays, Inter everywhere, minimal motion, no art direction.

---

## 1. Goals, Ranked

1. Make the storefront feel like a **premium D2C brand** (think Muji / Aesop / Oberoi-level restraint), not a Bootstrap admin panel.
2. Keep every existing behavior intact — this is reskin + layout + motion only.
3. Improve **perceived performance** (skeletons, transitions, optimized images) and real performance (Cloudinary transforms, Lighthouse ≥ 90 on home/PLP/PDP).
4. Close real UX gaps found in testing: no mobile nav, no empty search suggestions, cart badge not updating visually after payment (already fixed), admin tables cramped on laptop.
5. Stay accessible (WCAG AA) and responsive (mobile-first; checkout flow is the priority viewport).

### Non-Goals

- No dark mode in this pass (Phase 2 candidate).
- No new pages, no new features, no CMS, no i18n.
- No component-library adoption (no MUI/Chakra) — we upgrade our own kit; it already matches the app's shape.
- No changes to API calls, state logic, or routing structure.

## 2. Hard Guardrails (read before touching anything)

1. **Do not modify** `lib/api/*`, `lib/auth/*`, `lib/cart/*`, `hooks/*`, or any mutation/query logic. The redesign touches presentation only.
2. Every data-fetching view keeps its skeleton → error → empty → content states (§13.4 of the original PRD).
3. All existing aria attributes, labels, and focus-visible styles must survive (upgrade their look, never remove them).
4. Route structure and URLs stay identical — no new routes, no renamed paths.
5. After each phase: `npm run build` must pass with zero errors, and a manual pass of register → browse → cart → coupon → checkout → mock/real pay → order page → admin dashboard must succeed.

## 3. Design System (the decisions — implement exactly)

### 3.1 Art direction

"Quiet luxury retail": warm neutral canvas, one confident accent, generous whitespace,
serif display type over sans body, photography forward, hairline borders instead of heavy
shadows, motion measured in 150–250ms.

### 3.2 Color tokens (Tailwind theme extension, CSS variables)

| Token | Value | Use |
|---|---|---|
| `canvas` | `#FAF9F7` (warm off-white) | page background |
| `surface` | `#FFFFFF` | cards, header, modals |
| `ink` | `#1C1B1A` (warm near-black) | primary text |
| `ink-soft` | `#6E6A65` | secondary text |
| `line` | `#E8E5E0` (warm hairline) | borders, dividers |
| `accent` | `#8A5CF6`? **No** — use `#0F5C4C` (deep emerald) | CTAs, links, focus, price accents |
| `accent-hover` | `#0C4B3E` | CTA hover |
| `accent-soft` | `#EDF5F2` | selected states, tinted chips |
| `sale` | `#B4432F` (brick red) | discount badges only |
| `gold` | `#B08D57` | ratings stars, "premium" flourishes |
| Success/warn/error keep hue, retuned to warm palette (`#2E7D5B` / `#B7791F` / `#B4432F`) |

Rationale: emerald reads premium against warm neutrals (fresh-goods connotation for a
"shelf" brand), avoids the default-indigo SaaS look, and passes AA with white text on CTAs.

### 3.3 Typography

- **Display (headings, prices, hero):** `Fraunces` variable (opsz axis), weights 500–600 — a contemporary serif with warmth. Via `@fontsource-variable/fraunces`.
- **Body/UI:** `Inter` variable (already in use). Via `@fontsource-variable/inter`.
- Scale (rem): `0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 2.5 / 3.75 / 5` with tightened leading on display sizes (`1.05–1.2`).
- Rules: prices always display font; ALL-CAPS only for micro-labels (eyebrows, badges) at `0.6875rem` with `+0.08em` tracking; never center long body text.

### 3.4 Shape, depth, motion

- Radius scale: `4px` inputs/buttons · `10px` cards · `16px` hero/media · pills for chips/badges.
- Depth: `shadow-none` for most surfaces + 1px `line` borders; elevation only on interaction (`shadow-lg` on card hover, modals). One soft ambient shadow on sticky elements.
- Motion (all `ease-out`, 150–250ms):
  - Cards: image scales 1→1.04, quick-add button slides up 8px, border darkens.
  - Buttons: subtle press (`translateY(1px)`), never color-jump.
  - Page content: fade+rise 8px on route change (a tiny `<PageFade>` wrapper — CSS only, no library).
  - Skeletons: shimmer gradient instead of pulse.
  - Toasts: refined styling; success gets a hairline accent bar.
- Reduced motion: all transforms gated behind `prefers-reduced-motion` (media query sets durations to 0).

### 3.5 New shared primitives (add to `components/ui`)

| Primitive | Spec |
|---|---|
| `<Eyebrow>` | micro-label (caps, tracking, ink-soft) |
| `<Price>` | display font, current + struck-through original + `−x%` in `sale` |
| `<ProductMedia>` | 4:5 media frame, `object-cover`, Cloudinary-optimized (§5), hover zoom |
| `<Chip>` | pill for filters/variants (selected = accent-soft + accent text + hairline) |
| `<QtyStepper>` | −/value/+ replaces raw number input in cart/PDP |
| `<SectionHeader>` | eyebrow + display title + optional "view all" link |
| `<EmptyState>` upgrade | line-art icon (lucide), display title, softer copy |
| `<Stepper>` | numbered checkout progress (Address → Review → Payment) |

Dependency additions (the only ones allowed): `lucide-react` (icons), `@fontsource-variable/fraunces`, `@fontsource-variable/inter`. Remove `react-hot-toast` default styles override via its `toastOptions` (no new toast lib).

## 4. Storefront — Page-by-Page

### 4.1 Global chrome

- **Header:** taller (72px), `surface` with hairline bottom; logo set in Fraunces; category links become an understated text nav; right side: search, wishlist (heart), account, cart with count badge. **Mobile: hamburger → slide-in drawer** (real gap today: nav is simply hidden under `md`). Sticky with `backdrop-blur` only after scroll > 0.
- **Footer:** three columns (shop links, help, brand blurb) + payment-method text row; hairline top border.
- **PageFade** wrapper on route content.

### 4.2 Home

- **Hero:** full-bleed 2-column — left: eyebrow + Fraunces headline (one size down from h1 of old), one-line sub, CTA pair (solid accent + ghost); right: curated product imagery in a rounded-16 frame with subtle parallax on scroll (transform only). No gradient banner (delete the indigo→violet block).
- **Category rail:** horizontal scroll of circular image chips (Cloudinary product thumbs), hairline scroll affordance.
- **"Top rated" / "New in"** sections: `SectionHeader` + 4-col grid of upgraded `ProductCard`s.
- **Editorial strip** (one, static): image + 2-line copy + link — gives the page magazine rhythm; no carousel.

### 4.3 ProductCard (the most-seen component — nail it)

- `ProductMedia` 4:5 frame, image via Cloudinary `w_600,q_auto,f_auto`.
- Name (2-line clamp, body font), brand eyebrow, `Stars` (gold), `Price`.
- Discount = `sale` badge on media corner; out-of-stock = frosted overlay chip.
- Hover: zoom + quick-add button ("Add" with plus icon) slides in over media bottom — calls the same `addToCart` mutation; hidden on touch devices (`hover:` only).
- Grid gap consistent `gap-6`; card is a link except the quick-add (stopPropagation).

### 4.4 PLP

- Layout: filter sidebar becomes a **collapsible on mobile** (bottom-sheet style drawer triggered by "Filters" chip showing active count); desktop sidebar unchanged positionally, restyled with hairlines and Chips.
- Toolbar: result count + sort select (restyled) + view toggle (grid density 3/4-col — optional, default 3).
- Active filters render as removable Chips above the grid.
- Pagination → numbered pill pagination (max 7 slots with ellipsis) + keep Previous/Next for a11y.

### 4.5 PDP

- Two-column: **left** gallery (main 1:1 media + thumbnail strip; thumbnail click swaps with fade; pinch/hover zoom is Phase 2), **right** sticky buy box (`lg:sticky top-24`): brand eyebrow, Fraunces title, stars → scroll-link to reviews, `Price` block, stock line ("Only 3 left" in warm amber), variant selector as Chip group (disabled = struck), `QtyStepper`, full-width Add to Cart (accent, lg), wishlist ghost button.
- Below: Description as a proper prose block, **Reviews section** with rating summary (average big in display font + distribution bars 5→1), review list cards, review form in a modal instead of inline.
- Related products: `SectionHeader` + card row.

### 4.6 Cart

- Line items with 4:5 thumb, name link, variant chip, unit price, `QtyStepper`, remove as quiet icon-button with confirm-on-second-tap (mobile) — no modal.
- Right column: summary card (surface, hairline, radius-10) with coupon input as one quiet field + apply; totals typography per §3.3; **free-shipping progress bar** (accent fill, "₹X away from free shipping" — copy only if threshold feature exists server-side; otherwise show flat-rate line as today).
- Sticky bottom bar on mobile: total + "Checkout" CTA.

### 4.7 Checkout

- Two-column with **Stepper** (1 Address · 2 Review · 3 Payment) reflecting current single-page sections — visual stepper, not multi-step refactor (guardrail: no flow change).
- Address cards: radio restyled as selection cards with accent hairline; "Add address" as dashed quiet card.
- Payment step: order summary stays right/sticky; Pay button becomes the single loudest element on the page; trust micro-copy ("256-bit secure · signature-verified payments") under it; Razorpay/Mock badge text.
- On success → order page already handles it; add a celebratory-but-restrained confirmation header (check icon, "Order confirmed", order number).

### 4.8 Orders / OrderDetail

- List: card rows with status `Badge` (retuned colors), thumbnail stack for items, total in display font.
- Detail: tracker upgraded to labeled progress rail (done = accent fill, current = pulse ring, future = hollow), timeline as left-border ledger with date gutter; shipment block with carrier + tracking in mono chip; cancel/return actions in a quiet action row (danger only on hover/confirm modal as today).

### 4.9 Auth & account

- Login/Register/Reset: centered card on `canvas` with brand mark, single column, inputs per §3.4; social-spacing not needed (no OAuth).
- Profile/Addresses: restyled forms, address cards with default badge chip, edit/delete quiet actions.

## 5. Image Performance (Cloudinary — free wins, do these)

All product images are already `res.cloudinary.com/<cloud>/...`. Add `lib/utils/image.js`:

```js
export function cimg(url, { w = 800, h, fit = 'crop' } = {}) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  const t = [`w_${w}`, h ? `h_${h}` : null, `c_${fit}`, 'q_auto', 'f_auto'].filter(Boolean).join(',');
  return url.replace('/upload/', `/upload/${t}/`);
}
```

- Cards: `w_600` · PDP main: `w_1000` · thumbs: `w_160` · hero/editorial: `w_1400` · category chips: `w_160,h_160`.
- `loading="lazy"` everywhere except PDP main and hero (`fetchpriority="high"` on hero).
- This is also the Lighthouse fix: currently PLP loads full-size uploads.

## 6. Admin (same system, calmer)

- Sidebar: slim (64px collapsed → 220px on `lg`), ink-on-canvas, active item = accent-soft chip; icons (lucide) + labels.
- Stat cards: eyebrow + Fraunces number + delta hint line; uniform height; grid gap-4.
- Tables: hairline rows, no zebra, sticky header, row hover = canvas tint, actions become icon-buttons with tooltips; horizontal scroll wrapper retained.
- Dashboard charts: recharts retokened (axis ink-soft, grid `line`, accent/gold series, tooltip surface card).
- Modals/drawers: admin gets right-side **drawers** for edit forms (products, coupons) instead of center modals — better for long forms; keep Modal for confirmations.
- Admin remains light theme (dark sidebar-only is Phase 2 if ever).

## 7. Accessibility & Responsive (acceptance-tested, not assumed)

- AA contrast for all token pairs (verify ink-on-canvas 12:1, accent-on-white ≥ 4.5, white-on-accent ≥ 4.5).
- Focus ring: 2px accent offset ring on every interactive element; never `outline: none` without replacement.
- Touch targets ≥ 44px (QtyStepper, icon buttons, chips).
- Test widths: 360 (mobile), 768, 1024, 1440. Checkout and PDP at 360 must be flawless.
- Keyboard: mobile drawer and all modals trap focus; Esc closes; filters operable via keyboard.

## 8. Phases (implement in order; each ends buildable + manually verified)

| Phase | Contents | Acceptance |
|---|---|---|
| **U1 — Foundations** | Tailwind tokens (§3.2), fonts (§3.3), global css (§3.4), `cimg()` helper, primitives (§3.5), header/footer + mobile drawer, PageFade | Build passes; every page renders in new skin via tokens alone (no page-level redesign yet) |
| **U2 — Shop core** | Home, ProductCard, PLP (+filters/chips/pagination), PDP (+sticky buy box, reviews summary) | Mobile 360px pass on PLP+PDP; Cloudinary transforms live; quick-add works |
| **U3 — Commerce flow** | Cart, Checkout (stepper styling), Orders, OrderDetail tracker/timeline, Auth/Account pages | Full purchase journey manually passes; stepper reflects sections; tracker states correct for SHIPPED sample |
| **U4 — Admin** | Sidebar, stat cards, tables, charts retoken, drawers for edit forms | All admin pages render; product edit via drawer works incl. variants; analytics numbers unchanged |
| **U5 — Polish & perf** | Motion audit, reduced-motion, Lighthouse runs (perf/a11y ≥ 90 on /, /products, PDP), contrast audit, empty/error state photography | Lighthouse scores recorded in PR (the "measured, not invented" numbers for the resume) |

## 9. Out of Scope / Later

Dark mode · PDP image zoom/carousel gestures · homepage CMS · animation libraries (framer-motion) · A/B anythings · i18n.
