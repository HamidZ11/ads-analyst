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
- Nav item height 32px, gap 2px, group gap 16px. Sidebar padding 12px.
- Inputs and secondary buttons 32px high; small buttons 28px; segmented controls 28px in a 32px track.

## 7. Layout regions

Taken from the wireframe reference: sidebar → page header → main → optional right rail.

- Sidebar: fixed 240px from 1024px. Top: product mark + agency, then client switcher. Middle: grouped primary nav. Bottom: data-status line. Nothing else.
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

- Grouped lists with 11px uppercase group labels (`ink-faint`).
- Items: 16px icon at 1.75 stroke, 13px 500 label. Active: `accent-soft` fill, `accent-strong` text, 2.25 stroke. Hover: `surface-hover`. `aria-current="page"` on the active link.
- Client switcher: 40px button, initials mark (accent fill when selected), name + type/currency line, chevrons icon. Menu uses radio semantics with a check indicator.
- Breadcrumbs are not used in APP 01; the page header carries context.

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
