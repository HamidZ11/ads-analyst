# Ad Analyst — Design System

Concrete implementation rules for every UI pass. If a rule here conflicts with a reference screenshot or a component library default, this file wins. Tokens live in `src/app/globals.css`; primitives live in `src/components/ui/`.

## 1. Principles (as rules)

1. The data is the loudest thing on the page. Chrome is quiet: white surfaces, hairline borders, grey text, one blue.
2. Density is a feature. Default to 13px body text, 32–40px rows and 16px card padding. Add space between groups, not inside them.
3. Blue means "selected" or "the series you are looking at". It is never decoration.
4. Every number has a comparison or a target next to it, or it does not belong on a KPI tile.
5. Placeholders are honest. An unfinished area says what it will do and when; it never shows fabricated findings.
6. One system. New UI extends `src/components/ui/`; it does not import a second component library.

## 2. Colour tokens

| Token                        | Hex                   | Use                                                                     |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `canvas`                     | `#f5f6f8`             | Page background                                                         |
| `surface`                    | `#ffffff`             | Cards, sidebar, top bar, inputs                                         |
| `surface-subtle`             | `#f8f9fb`             | Table headers, card footers, muted panels                               |
| `surface-hover`              | `#f2f4f7`             | Hover on rows, nav items, ghost buttons                                 |
| `surface-active`             | `#eaedf2`             | Pressed/neutral chips, neutral delta pills                              |
| `border`                     | `#e4e7ec`             | Default 1px border and dividers                                         |
| `border-strong`              | `#cfd5de`             | Input and secondary-button borders, dashed empty-state borders          |
| `ink`                        | `#0f172a`             | Primary text, numerals                                                  |
| `ink-secondary`              | `#3d4a5c`             | Secondary text, inactive nav labels                                     |
| `ink-muted`                  | `#667085`             | Captions, table headers, descriptions                                   |
| `ink-faint`                  | `#98a2b3`             | Placeholders, axis ticks, tertiary hints                                |
| `accent`                     | `#2563eb`             | Primary buttons, active chart series, selected text                     |
| `accent-strong`              | `#1d4ed8`             | Button hover, selected nav text                                         |
| `accent-pressed`             | `#1e40af`             | Primary button pressed state                                            |
| `accent-soft`                | `#e8f0fe`             | Selected nav item, selected segment, selected row, chart highlight band |
| `accent-border`              | `#b9cff7`             | Border of focused inputs and open menus                                 |
| `positive` / `positive-soft` | `#15803d` / `#e8f5ec` | Favourable deltas only                                                  |
| `negative` / `negative-soft` | `#b42318` / `#fdecea` | Unfavourable deltas only                                                |
| `warning` / `warning-soft`   | `#b54708` / `#fff3e0` | Reserved for future "watch" states                                      |
| `chart-primary`              | `#2563eb`             | The selected series                                                     |
| `chart-muted`                | `#a7b4c6`             | Earlier/comparison series                                               |
| `chart-grid`                 | `#eceff3`             | Gridlines                                                               |
| `tone-*` / `tone-*-ink`      | see css               | Creative thumbnail placeholders only                                    |

Rules

- Green and red are used only to colour a delta by direction × desirability. Never for status dots on structural entities (an active campaign is a green dot, not green text), never for headings, never as fills.
- There is one accent. Do not introduce a second hue for "AI", "insights" or categories.
- No gradients anywhere. No translucent "glass" panels. Overlays use `ink` at 30% only behind dialogs.

## 3. Surface hierarchy

- Level 0: `canvas`.
- Level 1: `surface` with `border` and `shadow-xs` (0 1px 1px rgba(16,24,40,0.04)). Cards, sidebar, header bars.
- Level 2: floating menus and sheets: `surface`, `border`, `shadow-md`.
- Inside a card, use `surface-subtle` for table headers and footers. Do not nest a bordered card inside a bordered card; use a divider.

## 4. Blue accent usage

Allowed: primary button, active nav item (soft fill + strong text), selected segment, selected table row (soft fill at 40%), focused input border, the selected chart series and its highlight band, links in body copy, the "Selected" badge.
Not allowed: card headers, KPI numerals, icons at rest, decorative bars, borders at rest, large fills.

## 5. Typography

Font: Inter via `next/font`, system-ui fallback. Letter-spacing −0.01em on headings.

| Token       | Size / line | Use                                                   |
| ----------- | ----------- | ----------------------------------------------------- |
| `text-2xs`  | 11 / 16     | Uppercase labels, axis ticks, pills, nav group labels |
| `text-xs`   | 12 / 16     | Captions, descriptions, table meta, deltas            |
| `text-sm`   | 13 / 20     | Body, table cells, nav items, inputs                  |
| `text-base` | 14 / 22     | Card titles when a card is the page's main object     |
| `text-lg`   | 16 / 24     | Secondary numerals (account structure counts)         |
| `text-xl`   | 18 / 26     | Page title                                            |
| `text-2xl`  | 22 / 28     | Reserved                                              |
| `text-3xl`  | 26 / 32     | KPI numerals                                          |

Rules

- Weights: 400 body, 500 labels and nav, 600 titles and numerals. Never 700+.
- Numerals in tables, ticks and inline comparisons use `tabular`. KPI numerals use proportional figures.
- Uppercase is only for 11px labels with `tracking-wide`.
- Section/card titles are sentence case. No trailing colons.

## 6. Spacing rhythm

4px base. Use 2, 4, 6, 8, 12, 16, 24, 32.

- Page gutter: 16px (<640), 24px (≥640), 32px (≥1024). Page vertical padding 20px/24px.
- Gap between cards: 16px. Gap between KPI tiles: 12px.
- Card padding: 16px horizontal, 14px top, 12–16px bottom. Card header to body: 12px.
- Table cell padding: 12px horizontal, first/last cell 16px. Header row 36px, body row 40px.
- Nav item height 34px, gap 2px; the Workspace group starts 20px below Analyse with one hairline and 16px of padding beneath it. Sidebar inner padding 12px (16px for the product header).
- Inputs and secondary buttons 32px high; small buttons 28px; segmented controls 28px in a 32px track.

## 7. Layout regions

Taken from the wireframe reference: sidebar → page header → main → optional right rail.

- Sidebar: fixed 240px from 1024px on `canvas` with a 1px `border` edge. Top: product mark with the agency beneath, then a "Client" label and the client switcher. Middle: grouped primary nav. Bottom: the data-state tile. Nothing else (§10).
- Page header: title (18px) left, one-line description below it, compact controls right (period label + preset control). It is per page, not a global bar.
- Main: max width 1440px, centred.
- Right rail: a 340px column on ≥1024px for contextual panels (spend breakdown, structure, later: insights). Below 1024px it stacks under the main column.
- No bottom bar. Status lives in the sidebar footer.
- Mobile (<1024px): 48px top bar with menu button, product mark and compact client switcher; sidebar becomes a 280px left sheet.

## 8. Cards

`rounded-lg` (8px), `border`, `surface`, `shadow-xs`. Header = optional 14px muted icon + 13px semibold title + optional 12px muted description, with compact controls aligned right (a dropdown, a legend, a count). Body padding per §6. Footer uses `surface-subtle` with a top border. No card may be empty: if there is no content, render an `EmptyState` inside it.

## 8a. Creative placeholders

Until imported creatives carry imagery, a creative's thumbnail is `{ tone, aspect, motif }` rendered by `CreativeThumbnail`.

- Tone (seven muted fills with a matching ink) gives colour variety; motif gives compositional variety. Both are seed data, not derived from the creative name.
- Motifs are abstract compositions on a 100×100 canvas drawn only in the tone ink at 15–85% opacity and the surface colour at 40–90%: `ugc`, `talking-head`, `product`, `before-after`, `carousel`, `clinical`, `testimonial`, `offer`, `catalogue`, `routine`, `screen`. They suggest a kind of creative; they never depict a brand, face, product or stock scene.
- Letterbox (`xMidYMid meet`) into the frame; never crop a motif. In the large size a 20px type marker sits bottom-left and the aspect label bottom-right; the small size shows the motif alone.
- Adjacent cards in a grid should differ in motif or tone. When adding seed creatives, pick the motif that matches the creative's format first, then a tone not used by its neighbours.
- No photographs, no external images, no gradients, no text beyond a single glyph or step number.

## 9. Tables

- Always wrapped in `overflow-x-auto`; never let a table widen the page.
- Header row: `surface-subtle`, 11px uppercase `ink-muted`, 36px, bottom border.
- Body rows: 40px, 13px, horizontal dividers only (`border`), hover `surface-subtle`. No vertical rules, no zebra striping.
- Numeric columns right-aligned with `tabular`. Primary numeric column (spend) in `ink` at 500; others `ink-secondary` at 400.
- Entity cells: name in `ink` 500, one 11px meta line beneath (objective, counts). Truncate at 360px.
- Sortable headers are buttons with `aria-sort` and a 12px arrow; the active column's arrow is `accent`.
- A totals row in `tfoot` when more than one row is visible.
- Real semantics: `caption` (visually hidden), `th scope="col"`.

## 10. Navigation

Production sidebar adopts Concept B — Premium Workspace Nav from `/sidebar-lab` (D-033). It supports the locked Overview and never competes with it.

- Hierarchy, top to bottom: product (28px ink mark, 14px 600 wordmark), agency (12px `ink-muted` beneath the wordmark), client (a 12px `ink-faint` "Client" label over the switcher), navigation, data state. Three levels of loudness, never three equal labels.
- Client switcher: a 44px white control with a 1px `border` and 6px radius; 28px pale-blue initials (`accent-soft` fill, `accent-strong` text) carrying an 8px `positive` dot when daily metrics are loaded; name 13px 500 `ink`; type · currency 12px `ink-muted`; `ChevronsUpDown` in `ink-faint`. Hover strengthens the border to `border-strong` and tints the surface; open state uses `accent-border`. Radix radio menu, check indicator, optimistic selection and the 70% pending opacity are unchanged. Never a large client card.
- Group labels: "Analyse" and "Workspace", 12px 500 `ink-muted`, sentence case, 6px above their list. One hairline separates Workspace from Analyse; no boxed sections.
- Items: 34px rows, 2px apart, 10px horizontal padding, 16px lucide icon with a 10px gap, 13px 500 label. Active: `surface` fill, 1px `border`, `ink` text, `accent` icon at 2 stroke, `aria-current="page"`. Inactive: transparent border, `ink-secondary` text, `ink-muted` icon at 1.5 stroke. Hover: `surface-active` fill and `ink` text. Never a solid blue row, a thick blue bar, a glow or a pill.
- Footer: a white tile (`border`, 6px radius, 10px/8px padding) with a 6px `positive` dot (`ink-faint` when no metrics are loaded), "Meta Ads · demo dataset" 12px 500 `ink-secondary`, and the coverage line 12px `ink-muted` tabular. No chevron until an action exists.
- Mobile: the same sidebar body renders inside the 280px `canvas` sheet, with the 48px top bar carrying the mark and the compact switcher. Radix traps and returns focus; navigating closes the sheet.
- Breadcrumbs are not used; the page header carries context.

## 11. Inputs and controls

- Inputs 32px, `border`, `rounded-md` (6px), 13px, placeholder `ink-faint`, hover `border-strong`, focus `accent-border` + 2px accent outline at offset 0.
- Buttons: primary (`accent` fill, white text), secondary (`surface`, `border-strong`), ghost (transparent). 32px/28px heights, 6px radius, 500 weight. One primary button per view at most.
- Segmented control: 32px track with `border`, 28px segments, selected segment `accent-soft` + `accent-strong`. Disabled segments `ink-faint` with a `title` explaining why.
- Native `select` is acceptable for simple sort controls; style it like an input.

## 12. States

- Hover: `surface-hover` fill on rows, nav items, menu items, ghost buttons. Never change text colour alone.
- Selected: `accent-soft` fill (+ `accent-strong` text for nav/segments; `ink` text for rows).
- Focus: 2px `accent` outline, 2px offset, on every interactive element (`:focus-visible`). Inputs use offset 0.
- Disabled: `ink-faint` text, no fill change, `cursor-not-allowed`.
- Pending (server action in flight): opacity 70% on the control, `aria-busy`.

## 13. Charts

- One axis per chart. Two measures → two stacked small multiples (see Overview trend), never dual axes.
- Line 2px, round joins. Area wash at 10% opacity of the series colour. Gridlines 1px `chart-grid`, three per chart (max, half, zero). Ticks 11px `ink-faint`, nice numbers (1/2/2.5/5 × 10ⁿ).
- Selected period: `chart-primary`; earlier period: `chart-muted`. The selected period gets an `accent-soft` band at 40%.
- Legend top-right of the card header when a chart has ≥2 series or two periods. Single-series sparklines have no legend.
- Sparklines: 88×26, 1.5px line, 2.5px end dot with a white ring, previous period muted.
- Bars (spend breakdown): 6px tall, `accent` on an `accent-soft` track, label and value in text tokens.
- Interactive layer (crosshair, tooltip) and a chart library arrive in APP 02. Until then charts are static SVG with `vector-effect: non-scaling-stroke`.
- No animation on charts in APP 01.

## 14. Icons

lucide-react only. 16px in navigation, 14px in card headers and KPI tiles, 12px inside deltas and sort headers. Stroke 1.75 at rest, 2.25 when active. Colour `ink-muted` or `ink-faint`; never `accent` except the active sort arrow and menu check. Every icon-only button has `aria-label`; decorative icons are `aria-hidden`.

## 15. Empty, loading and error states

- Empty: `EmptyState` with dashed `border-strong`, `surface-subtle`, optional 16px icon in a 32px bordered square, 13px title, 12px description, optional action. Copy says what will appear and what produces it.
- Loading: render the final layout with `surface-active` blocks in place of values; never spinners in cards. (No loading states ship in APP 01 because all data is local.)
- Error: 12px `negative` text with an icon inside the affected card, never a full-page error.
- Never lorem ipsum, never "coming soon" banners. Use the `Note` component for a single-line scope hint at the bottom of a page.

## 16. Responsive principles

- Breakpoints used: 640 (sm), 768 (md), 1024 (lg), 1280 (xl), 1536 (2xl).
- KPI grid: 2 columns below 768, 3 columns from 768 up. Six metrics render as two rows of three. Tiles never go six across: with a side-by-side sparkline a tile needs about 280px of inner width to keep a 26px numeral and its comparison line unclipped, and six across gives under 150px even at 1440.
- KPI tile below 640: the sparkline is dropped and the delta pill sits under the numeral, so two tiles fit at 360 without clipping. Numerals are `whitespace-nowrap` and never `truncate`; the comparison line may wrap to two lines.
- Overview: main + 340px rail from 1024; stacked below.
- Creatives grid: 1 / 2 / 3 / 4 columns at <640 / 640 / 1280 / 1536.
- Tables keep their columns and scroll horizontally inside the card. Do not hide numeric columns to avoid scrolling.
- Page header stacks (title above controls) below 768.
- Minimum tap target 32px; menu and dialog triggers 32px square.
- Verified widths: 1440, 1280, 390, 360.

## 17. Density rules

- Three KPI tiles per row on desktop; never more than four. Order metrics by importance so the first row carries spend, revenue and conversions.
- Card descriptions are one line. Longer explanations go in `Note` or documentation.
- A list panel shows at most six items plus an "n other" aggregate.
- Prefer a 40px table row over a card per record once there are more than eight records.
- Whitespace goes between sections (16px) and between groups (24px), not inside components.

## 18. What not to do

- No gradients, glassmorphism, blur, 3D, illustrations or "AI sparkle" visuals.
- No radii above 8px on containers; 4px on chips and pills. No fully round buttons.
- No shadows beyond `shadow-xs` on static surfaces and `shadow-md` on floating ones.
- No second accent colour, no coloured ID chips, no more than one pill per table row.
- No bento mosaics or oversized hero cards. Cards are sized by their content.
- No dual-axis charts, no rainbow categorical palettes, no number on every data point.
- No motion outside the rules in §20: no `transition: all`, no scale pops or spring bounce on controls, no blur, no ambient or looping motion, no animated gradients, no confetti or particles, no dramatic card lift on hover.
- No dark theme in APP 01 (tokens are structured to allow one later).

## 19. What the references contributed

- Sprint-planning dashboard (light): KPI tile anatomy (label + functional icon, large numeral, delta pill), card headers with a compact right-aligned control, a right rail for contextual panels, uppercase nav group labels, 8px radii, hairline borders.
- Layout wireframe: the region model in §7 (sidebar, main, right rail), and the decision not to ship a bottom bar or an icon rail in APP 01.
- Rituals dashboard (dark): nav group labels with count badges (deferred), inline "increase compared to last week" comparison text (adopted as the KPI comparison line), chart legends with a period chip top-right.
- Deliberately not copied: coloured ID chips, vertical table rules, dark theme, hatched bar fills, progress rings, breadcrumb top bar, global search.

## 20. Motion

Motion explains state changes; it never decorates. Reference studied: transitions.dev (origin-aware menus, indicator-follows-selection tabs, named properties, tokenised durations, mandatory reduced-motion guard). Intended feel: modern, precise, fast, premium, restrained, analytical. Never playful, bouncy or slow.

### Durations

| Token                   | Value | Use                                                                                                |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| `--duration-micro`      | 120ms | Colour changes on hover, press, focus and selection; the Tailwind default for every `transition-*` |
| `--duration-quick`      | 160ms | Menu enter and exit, overlay exit, pending-state opacity                                           |
| `--duration-standard`   | 220ms | Indicator slides, content reveals, page enter, overlay enter, sheet exit                           |
| `--duration-deliberate` | 300ms | Sheet enter only                                                                                   |

`--default-transition-duration` is 120ms, so any Tailwind `transition-*` utility is micro unless `duration-quick`, `duration-standard` or `duration-deliberate` is added. No other durations exist; never write a literal Tailwind duration class or a raw millisecond value in a component. Chosen so that a hover reads as immediate (under 150ms), a menu is visibly animated but never waited for (160ms), and the largest movement on screen, the mobile sheet, completes inside a third of a second.

### Easing

| Token             | Curve                           | Use                                                               |
| ----------------- | ------------------------------- | ----------------------------------------------------------------- |
| `--ease-enter`    | `cubic-bezier(0.16, 1, 0.3, 1)` | Anything appearing: menus, sheets, overlays, reveals, page enter  |
| `--ease-exit`     | `cubic-bezier(0.7, 0, 0.84, 0)` | Anything leaving: menu and sheet close, overlay fade-out          |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`    | State changes in place: colours, the segmented indicator, opacity |

Exits are never longer than enters (menu 160/160, sheet 300/220, overlay 220/160). No springs, no overshoot, no bounce anywhere.

### Allowed properties

- Preferred: `transform`, `opacity`.
- Allowed: `color`, `background-color`, `border-color`, `fill`, `stroke`, `outline-color`.
- Permitted exception: `width` on the segmented-control indicator (a 28px element inside a 32px track), because the slide materially shows the selection moving. Nothing else animates layout.
- Forbidden: `transition: all`, `height`, `top`/`left`, `box-shadow`, `filter`, `backdrop-filter`, `mask-position`, gradients. Always name the properties (`transition-colors`, `transition-opacity`, `transition-[transform,width]`).

### Reduced motion

Mandatory. `globals.css` collapses every animation and transition to 0.01ms under `prefers-reduced-motion: reduce`, and every keyframe utility is also applied with `motion-safe:` or paired with `motion-reduce:animate-none`, so nothing moves and nothing waits. Essential state changes (selection, open/closed) still happen instantly; only the motion disappears.

### Menus (client switcher, future dropdowns)

Enter `animate-menu-in`: opacity 0→1 with `translateY(-4px) scale(0.98)`→none, quick, ease-enter, origin from `--radix-dropdown-menu-content-transform-origin`. Exit `animate-menu-out`: the reverse, quick, ease-exit. The trigger shows `data-[state=open]` colours through `transition-colors` (micro), and its chevron icon takes `accent-strong` while open via a `group-data-[state=open]` variant; no icon rotation, since the chevrons glyph is symmetric. Items highlight with `transition-colors`. Selecting an item closes the menu immediately; the trigger label updates optimistically so the choice is visible before the server round trip completes.

### Dialogs, sheets and panels

Overlay `animate-fade-in` (standard) / `animate-fade-out` (quick). Sheet `animate-sheet-in` (translateX −100%→0, deliberate, ease-enter) / `animate-sheet-out` (standard, ease-exit). Content is never scaled. Future centred dialogs use `menu-in`/`menu-out` with `scale(0.98)`, never a bounce. Radix owns focus: it traps focus inside the sheet and returns it to the trigger on close. Navigating from inside the sheet closes it instantly (the route changes beneath it) and the new page plays its enter animation.

### Tabs and segmented controls

One indicator element carries the pale-blue fill and slides to the selected segment with `transition-[transform,width] duration-standard ease-standard`. The selection updates optimistically (`useOptimistic`) so the indicator moves on click, before the server confirms. The first paint has no transition. Labels change colour with `transition-colors`.

### Navigation and pages

Nav items change fill and text with `transition-colors` (quick). Each route change plays `animate-page-in` on the page template: opacity 0→1 and `translateY(4px)`→none, standard, ease-enter. Server-action re-renders (client or period switch) do not replay it.

### Buttons and hover

Focus rings appear instantly: `:focus-visible` outlines are not transitioned, because keyboard users need immediate confirmation. Inputs transition their border colour (micro) alongside the instant outline.

Buttons transition colours only (quick): hover one step darker or a `surface-hover` fill, press one further step (`accent-pressed`, `surface-active`). No scale on press, no lift, no shadow change. Table rows and menu items use `transition-colors` for hover fills. Non-interactive cards do not react to hover at all.

### Charts (APP 02 direction, do not implement in APP 01)

- Charts animate to explain a data change, never to decorate. The default state of a chart is still.
- When the client or period changes, existing series morph to their new values (path interpolation, standard duration, ease-standard) so the eye can follow what moved. Axes rescale in the same transition.
- Entrance animations do not replay on routine navigation or re-render. A series reveals once, on first paint of a view, with a single 220ms fade or draw; returning to the page shows the chart already drawn.
- The previous-period series stays visually secondary during and after any transition: muted colour, no emphasis animation.
- The selected-period band moves with `transform`, never by re-laying out the chart.
- No bouncing bars or lines, no elastic easing, no overshoot on value changes.
- No staggered, per-point showpiece animation on routine navigation. Stagger, if ever used, is limited to a first reveal and totals under 220ms.
- Hover and tooltip layers use micro colour and opacity transitions only; crosshairs move without easing.

### Numbers (APP 02 direction)

KPI numerals may tween between values over the standard duration with ease-standard when the client or period changes, so the reader sees the magnitude of the change. Deltas and pills crossfade (`opacity`, micro) rather than count. Values that change sign or become unavailable swap instantly. Under reduced motion every number swaps instantly.

### Loading states

Pending server actions set `opacity-70` with `transition-opacity duration-quick` on the control that caused them. Skeletons, when introduced, are static `surface-active` blocks that crossfade to content with `animate-fade-in`; no shimmer.

### Success and error states

Revealed content (Ask Analyst response, future insight cards) enters with `animate-rise-in` (opacity + 4px rise, standard, ease-enter). Errors use the same reveal in `negative` text; no shake, no pulse.

### Future content motion (APP 02+, document only)

- Insight cards: when findings change, new cards rise in (`rise-in`, standard) and removed cards fade out (quick); unchanged cards stay put. No list-wide re-entrance on refresh. At most one reveal per card per data change.
- Ask Analyst results: the answer block rises in once (standard); supporting figures and source links appear with it, not in sequence. No typewriter effect, no streaming cursor blink.
- CSV import progress: the progress bar fill moves with `transform: scaleX` (standard, ease-standard) on each reported step; completion crossfades the bar to a static summary (quick). Errors replace the bar with a `negative` message using the same reveal. No indeterminate spinners in cards; an indeterminate state is a static label plus the pending opacity treatment.

### Anti-patterns

No animation library: CSS transitions and keyframes are sufficient for everything specified here; a JavaScript motion dependency needs a written justification in DECISIONS.md.

`transition: all`; durations outside the three tokens; scale pops or spring bounce on controls; blur or backdrop filters; constant or looping ambient motion; animated gradients; confetti or particles; cards lifting dramatically on hover; animation that delays input or blocks a click; animating layout to cover for a missing design decision.

## 21. APP 01.7 production direction: Concept B with selected depth from C

**Approved checkpoint (2026-10-03):** The APP 01.8 Overview passed the owner's manual visual review and is locked. Preserve its current implementation, including Top campaigns / What changed. Further visual changes require a new explicit brief. Keep the unlinked design lab as reference; do not begin a sidebar redesign as part of this checkpoint.

The production composition is derived from the manually reviewed design lab. Concept B — Modern Product Analytics — is the primary reference and must remain visually dominant. Concept C — Premium Data Workstation — contributes only target status, contextual analysis, spend concentration, and ranked changes where they support the main reading. Concept A and conventional equal-card dashboard composition are rejected.

- Overview opens with a restrained account/date header, one lead performance reading, supporting metrics, and one wide chart. ROAS leads when a ROAS target exists; otherwise cost per conversion leads when a CPA target exists; otherwise spend leads with conversion context.
- The lead reading carries the strongest number hierarchy and makes current, previous, target, and distance from target legible without prose. Supporting metrics use strong but quieter numerals, compact deltas, and sparklines only where they help comparison.
- The primary chart is the analytical surface: the metric selector sits above it, the current period is blue, the previous period is quiet grey and aligned by day index, targets are dashed, and tooltip/end-value treatment stays restrained. The chart must retain usable width at 1280px; secondary context moves below when it cannot.
- One-day presets cannot imply intraday observations from daily totals. Show explicitly labelled trailing 14-day context, earlier days in grey, the final segment and selected-day band in blue. The headline and selector totals remain for the selected day. Multi-day presets retain day-index period overlays and tooltips name both dates.
- Overview plotting height is 320px on desktop and 280px on phones, with reserved axis/end-label gutters. Axes use compact zero-based nice intervals including the target; missing readings break both stroke and fill. Tooltip bounds belong to the plot, and the end label always reports the final day, not the hovered day.
- Supporting trends use only the selected period, occupy a consistent 64×20px frame, and are omitted for fewer than three readings, on phones, and for the compact CTR summary. Horizontal separators and shared numeric baselines group the KPI region; no vertical cell dividers. The contextual rail sits beside the chart from 1400px and reflows below at narrower widths.
- A compact contextual rail may sit beside the chart at wide desktop widths. It contains target status, spend concentration, and largest movers; it is secondary to the chart and never becomes a second hero.
- Lower analysis uses open, readable sections for top campaigns and what changed. Additional C-style modules belong below the first viewport and must earn their space.
- Campaigns remain a dense semantic table with sentence-case headers, tabular figures, status dots/badges only where useful, materiality-aware deltas, sorting, and quiet row hover. Creatives are a ranked ledger with artwork as identity, not an ecommerce-style card grid.
- The page is white; the navigation rail and secondary surfaces are pale cool grey. Blue is reserved for selection, target context, the active chart series, and meaningful current-state emphasis. No gradients, static heavy shadows, tracked uppercase labels, or bubbly container treatment.
- The route entrance animation uses backwards fill so its wrapper does not retain a transform and change the containing block for fixed descendants. Existing motion tokens and reduced-motion behaviour remain the system boundary.

## 22. Campaigns ledger (APP 01.9)

Production Campaigns adopts `/campaigns-lab` Concept B — Campaign Performance Ledger, with the cost-against-target relationship and the account summary from Concept C (D-034). It sits beside the locked Overview and sidebar and borrows nothing else.

- Composition is open: the page header (title, client · campaign count · delivering count, the period block and preset control), one row of account facts under a hairline, the toolbar on a hairline, the ledger, and a one-line comparison note. No cards, no outer frame, no roadmap copy.
- Account summary: four facts in one row (spend and outcomes with their change, campaigns over the cost target when one exists or delivering campaigns when none does, the largest movement from `rankCampaignMovers`). Labels 12px `ink-muted`, values 16px 600, detail 12px. Hairline dividers between cells from 768px; two columns on phones. Visually secondary to the ledger.
- Toolbar: status filter as underline tabs with counts (All · Active · Paused, `aria-pressed`, 2px `accent` underline on the selected tab), a 240px search, and a "Sorted by" readout that reflects the real sort. No controls without behaviour.
- Groups: Delivery (spend, change) · Outcome (conversions, change) · Efficiency (cost per conversion, ROAS or CPC, CTR). Group labels 12px `ink-faint` sentence case over a short rule; the first column of each group opens with a 32px gutter (24px below 1400px). No vertical rules, no tinted header row.
- Rows: 56px, hairline between rows, `surface` background, `surface-subtle` on hover. Identity first: name 14px 500 `ink` (paused `ink-muted`) truncated with a `title`; a 12px `ink-muted` second line with the status dot (filled `positive` for active, hollow `ink-faint` for paused), the word, objective, ad sets and ads.
- Comparison hierarchy: spend and outcomes at 14px 600 `ink`; the change beside them as a 12px `Delta` with "from {previous value}" in `ink-faint` beneath. Cost per conversion at 13px 500 `ink` with its target relationship beneath in 12px: "£110.83 over target" in `negative`, "£6.24 under target" in `positive`, "On target" muted, nothing when the client has no cost target. ROAS (or CPC) and CTR are plain `ink-secondary` tabular values.
- Change colouring: the ledger's materiality threshold is 5% (`LEDGER_MATERIALITY`); below it a change renders neutral. Spend is never coloured; outcome changes are coloured when material. The summary follows the same rule.
- Sorting: header buttons with `aria-sort`; the active column's label is `ink` with a 12px `accent` arrow for its direction; inactive arrows appear on hover or focus only. Default spend descending; name sorts ascending first.
- Totals: a row for the visible campaigns with the same column alignment ("Total · 8 of 9 campaigns" when filtered), spend and outcomes 600, changes against the previous period, account cost per conversion, ROAS and CTR. No tint; hidden when one row is visible.
- Responsive: numeric columns take their content width; the identity column takes the rest, capped at 380px from 1400px, 272px from 768px and 200px on phones. The table has an 880px minimum and scrolls inside its own wrapper; below 768px the identity column is sticky with a hairline right edge and the page never overflows. The sort readout hides below 640px.

## 23. Creatives board and inspector (APP 01.10)

Production Creatives adopts `/creatives-lab` Concept C — Analytical Creative Board as the page and Concept B — Creative Analysis Split View as the inspection interaction (D-035). It sits beside the locked Overview, sidebar and Campaigns and borrows nothing else.

- Composition is open: the page header (title, client · creative count · campaign count, period block and preset control), type tabs with counts on a hairline beside the "Ranked by" control, the type breakdown, the leaders, the remaining delivering creatives, a quiet idle strip and a one-line comparison note. No cards, no permanent split, no grey wash over the page.
- Type breakdown: three cells (Image, Video, Carousel) in one row divided by hairlines (stacked on phones): count, share of spend at 18px 600, spend, outcomes and ROAS (or cost per conversion when revenue is not tracked). Computed over every creative, not the filtered list; the cell of the filtered type carries a `surface-subtle` tint.
- Ranking: "Ranked by" is a real control (spend, outcomes, cost per conversion lowest first, CTR, ROAS when tracked). Rank numerals come from the active sort, section titles read "Leading by {metric}" and "ranked by {metric}", and the inspector's context line states "#n by {metric}". Creatives with no spend are never ranked.
- Leaders: the first two ranked creatives as full-width entries with 120×150 artwork (type and aspect markers visible), the rank and metadata line, a 16px title, and five metrics at 18px 600: spend, outcomes, cost with its target relationship, ROAS (or CPC), CTR with its change and one 64×20 trend across both periods when at least six readings exist.
- Remaining creatives: horizontal entries with 72×90 artwork, a 14px title clamped to two lines, and four metrics at 15px 600 (spend, outcomes, cost with target relationship, ROAS or CPC), in two ruled columns from 1400px and one column below.
- Idle creatives: "No delivery this period" with 20×24 artwork and muted names only; no performance values.
- Selection: every delivering entry is a stretched button with `aria-pressed`; the selected entry sits on `surface-subtle` with a 2px `accent` rule at its left edge and its rank in `accent-strong`. Hover is a faint `surface-hover` tint. No outline, glow, shadow or transform.
- Inspector: a non-modal Radix dialog on the right, 440px wide from 640px and full width below, white with a left hairline and `shadow-md`, entering with `rise-in` and leaving with `fade-out`. It opens on selection, updates when another entry is selected, closes on Escape or its close button, and returns focus to the entry. Content, top to bottom: context line ("#1 by spend · Video · 1 ad · 1 campaign"), title, 120×150 artwork beside the seeded headline and spend / outcomes at 18px with change; cost with target relationship, ROAS and CTR with change; a 120px daily spend chart in the Overview grammar (current blue, previous grey by day index, three ticks, end value; a one-day period shows a sentence instead); "Used in" with each ad, its campaign and spend; a now / before / change table. Factual only: no classifications, no prose findings.
- Metric hierarchy: identity, then spend and efficiency, then outcomes, then CTR and changes, then metadata. Changes use the 5% materiality rule; spend is never coloured; the cost target relationship is the only target indicator per entry.
- Artwork hierarchy: 120×150 leaders and inspector, 72×90 standard entries, 20×24 idle; always a fixed box with a 60% hairline on `surface-subtle` so aspect never changes the rhythm.
- Responsive: the toolbar wraps, the breakdown stacks below 640px, leader metrics fall to three then two columns, standard metrics to two, and the inspector covers the viewport below 640px. The page never overflows horizontally.

## 24. Insights workspace (APP 05 core)

Production Insights adopts `/insights-lab` Concept B — Decision Workspace — with the briefing sentence from Concept C — Analytical Briefing (D-036). Findings come from the deterministic engine (D-037); this section supersedes the "insight cards" note in §20.

- Composition is open: the page header (title, client · finding count · campaign and creative counts, period block and preset control), the briefing sentence, priority filters on a hairline with "Ordered by priority, then by spend involved" at the right, the workspace, and a one-line note that findings are computed from stored daily metrics and actions are advisory. No cards, no outer frame, no alert boxes.
- Briefing: one sentence built from the real counts, client and period ("3 issues need attention, 3 opportunities and 2 things to watch for Luxe Skin Co. in the last 7 days."; "No findings for Peak Fitness today."). 16px 500 `ink`, max 760px: stronger than the 13px description, quieter than the page title. No card, no large numerals.
- Filters: underline buttons with counts, All · High impact · Opportunities · Watch, `aria-pressed`, the Campaigns tab idiom (2px `accent` underline on the selected tab, count in `ink-faint`). Selection survives a filter change when the finding is still visible; otherwise the first visible finding is selected.
- Master/detail from 1280px: the list is 380px (400px from 1400px), the detail takes the rest behind a hairline with a 32px gutter (40px from 1400px). The detail is sticky with its own scroll so it stays in view while the list scrolls.
- List: group labels in C's language (Needs attention, Opportunities, Watch) 12px 500 `ink-secondary` with a count. Each row is a button: a 6px priority dot with the detector name in 12px `ink-muted`, the headline 13px 500 `ink`, the entity ("Campaign · {name}") 12px `ink-muted` truncated with a `title`, and one key value right-aligned (13px 600 `ink` tabular over a 12px label: "£138.83 / cost per purchase", "+60.5% / cost per purchase", "65% / in three campaigns"). Selected: `surface-subtle` with a 2px `accent` rule at the left edge; hover `surface-hover`. No borders, shadows or badges.
- Priority treatment: a 6px dot only. High impact `negative`, Opportunity `accent`, Watch a hollow `ink-faint` ring. The word appears in the detail ("● High impact · Campaign deterioration"). Green and red stay on deltas and target notes; a finding is never a coloured box.
- Detail anatomy, top to bottom: priority and detector; the headline 18px 600; the entity line ("Campaign · {name}", context such as the parent campaign or "Video · 2 ads · 1 campaign"); evidence; an optional chart; a breakdown or the now / before / change table; "Suggested action"; "Why this was flagged". Sections are separated by hairlines with 12px `ink-secondary` titles.
- Evidence hierarchy: three or four metrics that prove the headline and nothing else, 18px 600 tabular, with a 12px `Delta` at the 5% materiality threshold and/or a factual note ("from £59.72", "10% of campaign", "campaign £19.58"). The target is its own cell when it matters: value as the client set it ("£28") with "£110.83 over" in `negative` or "£6.24 under target" in `positive`. Clients without a target get no target language.
- Charts only where a trend is the evidence (daily conversions for deterioration and improvement, daily cost per conversion for a CPA spike, daily ROAS, daily CTR for CTR and fatigue findings, daily spend for scaling); none for zero-conversion spend, concentration or the underfunded ad, and none for one-day periods. Overview grammar at 140px: current blue, previous grey aligned by day number, zero-based ticks, end value; static; a visually hidden sentence carries the same reading.
- Breakdowns prove relative claims: the ads in the campaign (spend, share, cost, ROAS when tracked) for an underfunded winner; campaign shares with a 6px `accent` bar on an `accent-soft` track for concentration. The flagged rows carry a 6px `accent` dot and medium weight.
- Comparison: "Now against the previous period" with Metric · Now · Before · Change, only the detector's metrics, inside its own horizontal scroller.
- Action language: one advisory sentence ("Review budget allocation and inspect the ads driving the decline.", "Confirm conversion tracking, then consider reducing budget."). Never a button; no pause, budget or apply controls.
- Methodology: "Why this was flagged" on a `surface-subtle` panel, 12px, the rule in plain language with the observed values ("Spend rose by more than 10% while purchases fell by more than 10% against the previous period, leaving cost per purchase £110.83 above the £28 target."). No detector code, no internals.
- Empty states are sentences in the open layout, never illustrations: "No findings for this period" with what the engine checks and that it recomputes per client and period; filtered: "No high-impact findings for this period.", "No opportunities found for this period.", "Nothing to watch for this period." with how many findings sit under All.
- Responsive: below 1280px the list is full width and a finding opens in the sheet used by the Creatives inspector (non-modal Radix dialog, 480px from 640px, full width below, `rise-in` / `fade-out`, Escape and an "All findings" back control, focus returns to the row, "n of m" position). Tabs fit at 360px with 16px gaps; tables scroll inside themselves; the page never overflows.
- Motion: the detail rises in (`rise-in`) when the selection changes, not on first paint; filters change colour only; everything collapses under `prefers-reduced-motion`.

## 25. Ask Analyst — hybrid analytical thread

The owner selected `/ask-lab` Concept C — Hybrid Analyst Thread with the refined Beautiful UI-inspired composer and user turn. A was not selected; B was rejected (D-038). Conversation controls the query; the active answer controls the workspace. This production translation awaits manual review; the lab remains available.

- Open composition in the approved shell: title and real date controls, explicit client/current/previous scope, quiet history when it exists, one active analytical answer, follow-ups and an always-available bottom composer. No avatar, chat-card frame, giant bubbles, marketing illustration or decorative AI treatment.
- First use asks “What would you like to investigate?” with four supported starting questions. No history control at zero or one answered turn. Earlier answers live in a native collapsed disclosure; selecting one restores that answer and its entity context. Start fresh clears the thread but preserves the client and dates.
- Composer: pale cool-grey field, restrained hairline, one-to-two-line textarea, 36px dark square arrow button. Focus is neutral: the field turns white and its 1px border darkens to `ink-muted` (about 5:1 against the white field), with no accent border, outline or glow; the textarea keeps a transparent outline so forced-colours mode still draws a system focus ring. Empty input disables send. Enter submits; Shift+Enter inserts a newline; IME composition does not submit. While a real request is pending, the button cancels response delivery. Typed text is preserved on cancellation; retry preserves the failed question and scope.
- The current user turn is right aligned, compact, 13px/20px, neutral grey with an 8px radius; bounded to 75% on desktop and 85% on mobile. It is the only bubble. The answer is open on the white canvas: 20px headline, concise explanation, tabular evidence, an entity or comparison table, optional small chart, references, evidence limit and next inspection. Methodology is disclosed on demand.
- Answers use client currency and purchase/lead/trial vocabulary. Deltas use existing semantics and the 5% materiality convention. Spend changes are neutral. Only measured changes get semantic colour. Undefined ratios stay unavailable, never zero. Tables use semantic headings and local horizontal scrolling; charts repeat their reading in text and are omitted for fewer than three selected days.
- Insufficient evidence retains useful observations without claiming a cause. Fatigue is a proxy, not a proven explanation; absent data and the next source-account check are stated explicitly. Unsupported requests get a concise production limitation and supported follow-ups, never a fabricated analysis or lab-fixture language.
- Follow-ups are contextual query buttons, not chips with pretend filters. They use exactly the same interpreter, scope and request path as typed questions. The active answer's campaign/creative context resolves bounded references such as “that campaign”; ambiguous references require clarification.
- Motion: user turn and coherent answer use the existing standard `rise-in` (220ms). Pending reflects the real local request, with no artificial wait. Follow-ups fade in after one standard token using CSS only. Reduced motion removes animation and delay. No typewriter, typing dots, staged reasoning, blur or scale sequence.
- Responsive: the active answer scrolls within the available viewport; follow-ups and composer remain outside that scroller. At 1440/1280 the workspace uses the available product width. At 390/360 evidence reflows to two columns, labels wrap and wide tables scroll locally. History stays compact with a bounded scroll when expanded. Very short viewports can scroll the page to preserve usable controls.
- Scope changes reset the thread on the actual client/current/previous date key, abort pending response delivery and discard stale results. Current-page memory only; no cross-session chat system. Details are in D-039.

## 26. Data import and client onboarding

Meta Ads CSV import (D-040 to D-046) is a working tool page, not an upload wizard. It sits under Clients and follows the locked visual system: open white composition, hairlines, compact type, tabular figures, one blue.

- Entry points: Clients carries "Import Meta CSV" (primary) and "New client" (secondary, opens the flow with a new client selected) in the page header. The flow lives at `/clients/import`; Clients stays the active navigation item.
- Principle: detect by default, ask only what cannot be known. Inspection, mapping and validation run automatically after upload and again on the server; the person sees four steps (Upload, Review setup, Review import, Import) as one ordered list of numbered steps under the page header (`aria-current="step"`), never the seven technical stages (D-047). Each step has a 16px 600 heading that receives focus when the step changes.
- Upload: one dashed `border-strong` area on `surface-subtle` (8px radius, about 80px tall) with a sentence and a secondary "Choose file" button that labels the real, keyboard-focusable file input; dragging tints it `accent-soft` with an `accent` border. No illustration, no icon. A readable file moves straight to Review setup; an unreadable one gets one specific sentence in `negative` with `role="alert"`.
- Review setup: a "Detected in the file" row of facts between hairlines (file, dates and days, rows, campaigns with ad sets and ads, currency, conversion and value columns), then only the decisions we cannot make: the client (existing imported client, or a new client with name, business type suggested from the outcome columns, reporting timezone, optional cost and ROAS targets, and currency only when the file does not state one) and the conversions (primary conversion preselected when the file has an unambiguous column for the business type; a generic "Results" or "Conversions" column is offered but must be chosen; conversion value with a "None · ROAS won't be available" option). Dropdowns offer only columns that can hold the field: numbers for metrics, never IDs, ratios or dates.
- Advanced column mapping sits behind a native disclosure, collapsed by default, with a status beside it ("All required fields matched automatically · 20 columns used", or "1 required field needs a column" with a `negative` dot). It lists required and mapped fields only; "Show n more optional fields not found in the file" reveals the rest. It opens itself and focuses the field only when a required column is missing or a choice cannot hold its field. On phones the table scrolls inside itself.
- Blockers represent genuine uncertainty. Column and setting problems stay in Review setup as a message under the control (`aria-invalid`, `aria-describedby`) with focus moved there. File problems (unreadable values, several currencies or accounts, rows that disagree, multi-day rows) appear in Review import under "One thing stops this import", each with a filled `negative` dot, the hidden words "Can't import", a count and up to five sample lines; the import button becomes "Choose another file". Messages name the field and say what we couldn't determine; they don't tell the person to fix their CSV unless re-exporting is the only safe option.
- Everything safely resolvable is resolved and disclosed calmly under "Handled automatically" (hollow dot, `ink-secondary`, no samples): blank results read as 0, amounts carrying the import's own currency symbol, repeated rows, breakdown rows added together, total rows skipped, a time part on dates ignored, missing IDs, delivery status, creative or value columns. Notes are hidden while a blocker stands.
- Review import is the confidence checkpoint: the destination and account, dates and days, rows and ad-days, campaigns with ad sets and ads, spend, conversions in the client's vocabulary and conversion value or "Not imported", then "What we'll do" as a short list (import n daily ad rows, create or update the structure, update days already imported for existing clients, which columns count as conversions and revenue, which ratios are calculated). The primary button names the work ("Import 28 rows"); while importing the step becomes Import, the heading "Importing" and the section `aria-busy`.
- Import complete: "Imported successfully" with client, dates, campaigns, ads and spend, a quiet line of new and updated ad-days, primary "View Overview" (selects the client and opens `/overview`) and secondary "Import another file". No celebration.
- Imported data in the existing pages: no page branches on the source. Creatives without artwork show a neutral `surface-subtle` square with the type glyph (or an "image off" glyph for an unknown format) and an accessible "artwork not available" label; the type breakdown adds a "Format unknown" cell only when such creatives exist and drops the known-format cells only when no creative has a known format. A missing account ID is omitted rather than shown blank. The sidebar data tile reads "Meta Ads · CSV import" for imported clients.
- Clients: five columns read left to right: Client, Source, Targets, Data, then a quiet action. Rows are about 68px with two-line cells at 14px vertical padding; no column holds a single short value.
  - Client: a 28px `ClientMark` and the name (14px 500 `ink`), with one `ink-muted` 12px line of business type · currency · account ID. The name is always the first thing read.
  - Source: "Demo dataset" / "Seeded · read-only" or "Meta Ads · CSV import" / "Last import 2 Oct", as plain text with no badges.
  - Targets: one group, "CPA £28" over "ROAS 3.5x", labels `ink-muted` 12px and values `ink` tabular. A missing value is "Not set" (or "Not tracked" for ROAS without conversion value) in `ink-faint`. Never invented.
  - Data: a 6px status dot (`positive` with data, `ink-faint` without), then the day count over the date range, or "No data yet".
  - Action: the selected row reads "Selected" with a check in `accent-strong` and a 40% `accent-soft` fill; other rows have a quiet text button, "Select" with a chevron (`ink-secondary`, hover tint, `aria-label` naming the client). Never a filled button repeated down the table.
  - Below 768px the table becomes a list with the same order: identity and action on one line (the meta line wraps rather than truncating), then Source, Targets and Data as labelled rows indented under the name. Targets and data sit on single lines and actions are 44px tall. No page-level horizontal scroll.
- Settings: one column, max 880px, of four sections separated by hairlines rather than cards. Each section has a 14px 600 heading with one 12px `ink-muted` line of context on the left (220px) and its rows or form on the right; they stack below 768px.
  - **Account:** "Signed in as", the workspace and a secondary "Sign out" in a signed-in deployment; in demo mode, the agency and "Demo · read-only".
  - **Client:** name, business type (with what conversions are counted as), currency, reporting timezone and default comparison. The context line says these are fixed after the first import, or that demo clients are read-only.
  - **Performance targets:** imported clients get the Target CPA and ROAS form (blank clears; ROAS is disabled without conversion value; the result is announced with `role="status"`). Demo clients get the same values as read-only rows, with no inputs.
  - **Data:** source, coverage, ad account and, for imported clients, the latest import, the import count and the conversion and value columns, plus a secondary "Import a newer export" link to that client's import.
  - Only settings that exist are shown: no tabs, no settings sidebar, no speculative options.

## 27. Sign-in, account and empty workspace

Authentication is a utility, not a destination (D-049 to D-052). It uses the existing tokens and components; there is no marketing page, illustration or brand panel.

- Sign-in (`/sign-in`): the only screen without the app shell. A single 360px column on `surface`, top-aligned at about 18% of the viewport (never vertically centred in a hero), with the product mark, a 20px 600 "Sign in" heading, one `ink-muted` sentence ("We'll email you a one-time link. No password needed."), a "Work email" label over a 36px input, and one full-width primary button, "Email me a sign-in link" ("Sending link…" and `aria-busy` while pending).
- After sending: the form is replaced by a "Check your email" heading that receives focus inside `role="status"`, a sentence naming the address and telling the person to open the link in this browser, and a secondary "Send another link". The wording is identical whether or not the address has an account.
- Errors on sign-in are one sentence in `negative`: an invalid address sits under the field (`aria-invalid`, `aria-describedby`); an expired or reused link and an unavailable workspace appear above the form with `role="alert"`. Never a raw provider message.
- Unconfigured production deployment: the same column reads "Not connected yet" and names the environment variables. It never falls back to demo data.
- Account: Settings opens with an Account section ("You only see this workspace's clients and data.") with "Signed in as", the workspace and a secondary "Sign out". It renders even when the workspace has no clients. There is no avatar menu in the sidebar.
- Empty workspace: the sidebar replaces the client switcher with a 44px dashed `border-strong` box reading "No clients yet" in `ink-muted`; the mobile top bar omits the compact switcher. Analysis pages and Clients redirect to `/clients/import?client=new`; Settings shows the Account section, an "Import Meta CSV" header action and a Client section saying client settings appear after the first import.
- Labels: in a signed-in deployment the Settings row reads "Workspace" with the workspace name; demo mode keeps "Agency".
- Not found: unknown URLs answer with a 404 status and "Page not found" over "There's no page at this address." Signed out, it uses the sign-in column (product mark, 20px 600 heading) with a primary "Go to the home page" and a secondary "Pricing"; in an app session it sits inside the shell like the error boundary, with a primary "Go to Overview". Never a redirect.
- Recoverable failure: the app-level error boundary shows "This page couldn't load", one reassurance sentence, primary "Try again" and secondary "Sign in again" inside the shell. Database messages are never shown.

## 28. Marketing site

The public pages (`/` and `/pricing`, D-054) share one system in `src/features/marketing/`. It is premium software first, editorial discipline second, and separate from the app's visual language.

- Type and colour: Host Grotesk only (600 headlines with tight tracking, 17–19px body), on warm ivory `#f7f6f2` with deep ink `#0b1020`, quiet greys and warm hairlines `#e4e2db`. Cobalt appears in one field per page: a cobalt-to-navy plane with a soft texture drawn from real seeded spend. No other gradients.
- Controls: 6px-radius buttons, one filled primary per view, with a text link with an arrow as the secondary. The nav is inline from 1024px and a disclosure menu below that.
- Product proof: real components with seeded data, cropped to the claim of their section (`ProductCrop`). Wide crops render from 1024px; below that, crops of the product's real phone layout render at 0.9× or more. White panels use a 12px radius and a hairline edge. No fake UI, metrics, logos or testimonials.
- Motion: the hero settles; the product rises into its field and the floating finding follows; panels below the fold unveil top-down as they arrive. Hero motion is CSS-only so the server render never flashes. Reduced motion disables all of it.
- Icon and sharing: the favicon is the marketing mark, an ink `#0b1020` rounded square with the white chart line (`src/app/icon.svg`, with a 16/32/48px `favicon.ico` rendered from it). Share cards are text-only until approved Open Graph artwork exists (D-058).
- Pricing: two buying paths on one cobalt stage (D-055). Agency and Enterprise are equal white panels side by side from 1024px, with the same radius, padding and shadow. Their rows share a subgrid so name, line, price, sub-line, capacity, action and note align across both.
  - Agency keeps the 120px £29 with "/ month" and the quiet annual line. Enterprise answers with "Custom" at about 100px and "pricing" in the same position, so it is never small print.
  - Each panel's capacity sits in a hairline-ruled row with a check: "Up to 10 client accounts" or "More than 10 client accounts".
  - The product they share is listed once, in an "Included in both plans" band beneath both panels (warm white, ink underline title, two columns of hairline rows).
  - Agency's actions are Try the demo and Sign in. Enterprise's "Email us for pricing" is plain text and never styled as a link or button until a contact address exists.
  - Below 1024px the panels stack, Agency first, then the band. No tiers beyond these two, no comparison tables, no "Most popular" badges and no invented enterprise features.
