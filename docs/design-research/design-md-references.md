# DESIGN.md references for Ad Analyst

Source catalogue: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (73 real-product analyses in the Stitch DESIGN.md format). Seven candidates were read in full: Vercel, Linear, Cal.com, Coinbase, Stripe, IBM and HashiCorp. Five are selected below; Linear and HashiCorp are set aside because both are dark marketing systems whose only transferable ideas (one scarce accent, a 600 display ceiling, hairline cards) are already covered by the selected five.

These are **design grammar**, not brand imitation. Nothing here is merged into the production `DESIGN.md` yet; that merge is a separate, approved step.

Selection criteria: analytics or productivity posture, strong numerical hierarchy, excellent tables or data rows, professional light theme, refined spacing, restrained colour, polished desktop SaaS.

---

## 1. Vercel — stark light system, typographic precision

**Source:** `design-md/vercel/DESIGN.md` (getdesign.md/vercel)

**What it does well:** The cleanest stark system in the catalogue. One ink-black primary action, a white-on-white secondary, a four-step surface ladder (white cards on a 98% page, 95% insets, black inverted bands). Geist at 600 for display, 500 for buttons, 400 for body, sentence case with aggressive negative tracking. Elevation is stacked small shadows with an inset hairline, never one heavy drop. A full 100–1000 colour scale exists but the surface uses three steps of it.

**Relevant to Ad Analyst:** The discipline of a complete token set used sparingly; the display ceiling at 600; a type scale with a real middle (20/24/32 at 600 with -0.6/-0.96/-1.28px tracking) between body and hero; 4px base spacing with named steps (4/8/12/16/24/32/40/48/64); ~1400px page width with 24px desktop gutters; 16px interior padding for cards that sit in dense grids versus 24px for standalone cards.

**Do not copy:** the mesh gradient (brand-specific and explicitly rejected for Ad Analyst), monospace eyebrows (we have no technical-voice need), 100px pill CTAs, stacked shadows (our system is shadow-free on static surfaces), Geist itself.

**Concrete rules worth borrowing:**

- Headlines are sentence case, weight 600, with negative tracking that scales with size: about -0.03em at 24px, -0.04em at 32px. Never all-caps headlines; never weight 700.
- Three surface steps are enough on a page: white, a 98% tint, a 95% tint. Pick one and stay there within a region.
- Card padding depends on grid density: 16px inside dense grids, 24px standalone.
- One filled action colour per view; secondary actions are white with a hairline.

## 2. Stripe — tabular figures and dashboard pacing

**Source:** `design-md/stripe/DESIGN.md` (getdesign.md/stripe)

**What it does well:** The quiet financial-data signature: `font-feature-settings: "tnum"` on every money or numeric cell, a 14px tabular body with slight negative tracking, 13px captions for table labels. Dashboard surfaces pad at 32–48px while marketing pads at 64–96px, so product screens stay dense. Hairline 12px-radius cards with an optional single shadow tier. Pill buttons with tight 8px/16px padding feel transactional.

**Relevant to Ad Analyst:** numeric typography as a system rule rather than a per-cell choice; dashboard section spacing (32–48px) distinct from marketing spacing; the 15px default UI body as a counterexample (we chose 13px; Stripe's product UI runs larger than our current scale, which is worth testing); the deep navy ink (#0d253d) as a universal text colour that is not pure black.

**Do not copy:** the gradient mesh, weight-300 display type (reads thin and marketing-like for numbers), indigo accent, pill-shaped buttons.

**Concrete rules worth borrowing:**

- Every cell containing money or a count uses tabular figures; captions beside numbers use 13px at 400 with -0.03em tracking.
- Product surfaces: 32–48px between sections, 24px inside containers. Never 96px gaps inside a dashboard.
- One accent appears as one filled control per band; elsewhere it is link emphasis only.
- A navy ink (not #000) for all text keeps contrast high without harshness.

## 3. Coinbase — single blue, scarce; semantic colour as text only

**Source:** `design-md/coinbase/DESIGN.md` (getdesign.md/coinbase)

**What it does well:** An institutional financial surface that is almost monochrome, with one blue (#0052ff) carrying every primary action and nothing else. Trading up/down greens and reds are text colour only, never fills. Numerical values are set in a mono/number face at 18px 500. Asset rows are transparent with a 1px hairline divider, a 32px glyph, name plus ticker, and a right-aligned price column. Display type sits at weight 400, which reads calm rather than loud.

**Relevant to Ad Analyst:** this is the closest analogue for our blue-only accent and our green/red-for-deltas rule; the asset-row pattern maps directly onto campaign and creative rows (identity left, numbers right, hairline between); the "numbers in their own typographic register" idea answers our "weak tiny typography" problem for metrics.

**Do not copy:** 24px card radii and 100px pills (consumer geometry, explicitly rejected), dark hero bands, display at 400 for product headings (ours should be 600 to hold a dense page), Coinbase Mono.

**Concrete rules worth borrowing:**

- Semantic up/down colours are text only. Never a background fill, never a button.
- Numbers get their own register: a size and weight step above the body text they sit beside (for us: 14–15px at 500 tabular in rows, 24–32px at 600 for leads).
- Rows are transparent with hairline dividers; identity on the left, one or two numeric columns right-aligned; no row borders on the sides.
- The accent is scarce enough that its appearance means something.

## 4. IBM Carbon — density by design, hierarchy without shadows

**Source:** `design-md/ibm/DESIGN.md` (getdesign.md/ibm)

**What it does well:** Carbon is the reference enterprise data system: a strict 4px grid, hierarchy carried by hairlines and surface change (white to a light-grey step) rather than shadows, sentence-case eyebrows at 14px ("Carbon resists all-caps tracking"), one accent blue reserved for links and primary actions, 0.16px positive tracking on body for precision, and a 16-column grid at desktop. Sections separate by thin grey rows rather than large gaps. Dense by design, because its users expect to read a lot.

**Relevant to Ad Analyst:** permission to be dense and still disciplined; sentence case everywhere; hairline-and-surface hierarchy (which we already do); the explicit rule that blue is never a card background or eyebrow colour; a 16-column grid as a way to give the Overview one shared structure instead of per-section column splits.

**Do not copy:** 0px corners (reads as 2017 enterprise, explicitly not wanted), weight-300 display, IBM Plex, the utility bar and marquee page rhythm, the charcoal footer.

**Concrete rules worth borrowing:**

- Adopt one page grid (12 or 16 columns, 24px gutters) and align every section to it; no section invents its own split.
- Hierarchy = surface step + hairline. Shadows are not a hierarchy device on data screens.
- Eyebrows and section labels are sentence case at 13–14px, never tracked uppercase.
- Body text may carry slight positive tracking (0.01em) at 13–14px for legibility; headings carry negative tracking.

## 5. Cal.com — white canvas, restraint in states and radii

**Source:** `design-md/cal/DESIGN.md` (getdesign.md/cal)

**What it does well:** A white canvas with near-black actions, Inter for everything non-display, 13px 500 captions, 8px button radius, hairline inputs and table dividers, light-grey card surfaces (#f5f5f5) used deliberately to mean "abstract claim" versus white-with-chrome cards meaning "the real product". Two rules stand out: do not add hover styling beyond what the system encodes (primary darkens on press, nothing else moves), and do not repeat the same surface mode in two consecutive bands.

**Relevant to Ad Analyst:** confirmation that Inter at 400/500/600 on white with hairlines can feel premium when spacing and surface alternation are deliberate; the hover-restraint rule matches our motion system; the surface-alternation rule is a direct answer to our monotone page rhythm; the radius ceiling (16px on cards, 8px on controls) is a sane upper bound.

**Do not copy:** Cal Sans display face, 96px section rhythm (marketing pacing), the dark footer, pastel avatar fills.

**Concrete rules worth borrowing:**

- Alternate surface modes between consecutive sections (white → tinted → white); never stack two tinted or two outlined regions.
- Hover changes one property (fill or border). Nothing lifts, scales or glows.
- Controls: 8px radius, 600 labels. Cards: 8–12px radius, never above 16px.
- Light-grey panels mean "summary or claim"; white-with-hairline means "the data itself".

---

## Cross-reference: what all five agree on

1. One accent, used scarcely; semantic colours as text only.
2. Display weight ceiling of 600; sentence case; negative tracking that scales with size.
3. Hairlines and surface steps carry hierarchy; shadows are optional or absent.
4. 4px base spacing with named steps; product surfaces pad at 24–48px, not 96px.
5. Numbers have their own typographic register (tabular, a step heavier or larger than surrounding text).
6. A single page grid that every section respects.

## Set aside

- **Linear:** dark-only marketing surface; its four-step surface ladder and scarce lavender accent are already represented by Vercel and Coinbase.
- **HashiCorp:** dark, per-product colour identities and uppercase tracked eyebrows, all contrary to the Ad Analyst brief.
