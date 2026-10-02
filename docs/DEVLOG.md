# Development log

High-signal engineering record. One entry per meaningful implementation pass. Decisions with lasting consequences are recorded in [DECISIONS.md](DECISIONS.md) and referenced here by id.

---

## 2026-10-02 — APP 01 Foundation (pass 1)

**Phase:** APP 01 — product foundation.

**Objective:** Establish the Next.js shell, design tokens, typed domain model, deterministic seeded data for three clients, cookie-backed client context, and credible page shells for all seven routes.

**Decisions:** D-001 to D-011 (see DECISIONS.md). Highlights: light-only theme with a single blue accent; ad-level daily metrics with everything derived on demand; client and date preset in cookies read by server components; static SVG chart frames instead of a chart library; dataset anchored to today's date.

**Implemented:**

- Scaffold: Next.js 16.3 App Router, TypeScript, Tailwind 4, pnpm. Added radix-ui, lucide-react, clsx, tailwind-merge, vitest, prettier.
- `src/domain/`: types, period utilities (presets, previous range, timezone-aware today), metric aggregation and derivation, formatting, labels.
- `src/data/`: seed spec with keyframe curves, PRNG, generator, three client configs, `AdAnalystRepository` interface and indexed in-memory implementation, process cache rebuilt per calendar day.
- `src/features/`: workspace reader + server actions, navigation config, analytics read-model queries, per-page feature components.
- `src/components/`: ui primitives and shell (sidebar, mobile sheet, client switcher, date preset control).
- Pages: Overview (real KPIs, static trend frames, spend by campaign, account structure), Campaigns (sortable, filterable table with totals), Creatives (card grid with type filter, sort, CTR sparkline), Insights (scope strip + three honest empty sections), Ask Analyst (input, suggestions, not wired), Clients (table + select action), Settings (read-only).

**Important files:** `src/domain/metrics.ts`, `src/domain/periods.ts`, `src/data/repository.ts`, `src/data/seed/generator.ts`, `src/data/seed/clients/luxe-skin.ts`, `src/features/workspace/server.ts`, `src/components/shell/app-shell.tsx`, `src/app/globals.css`.

**Trade-offs:**

- Cookie-backed client context means switching client is a server round trip (fast locally; all pages dynamic). Chosen over client-side state to keep pages server-rendered and hydration-safe.
- Seeded conversions are Poisson-sampled, so low-volume entities are noisy week over week. Realistic, but required steeper curves for patterns D and F and larger volumes for Arc Cloud.
- Date presets are functional via cookie even though full date filtering is APP 02; the cost was small and the utilities needed exercising.

**Bugs found / fixed:**

- Server component passed lucide icon components to a client component (`NavLinks`) → RSC serialisation error. Fixed by importing the nav config inside the client component.
- `setState` in `useEffect` to close the mobile sheet on navigation flagged by `react-hooks/set-state-in-effect`. Fixed by keying the sheet on `pathname`.
- Narrowing error in the line-chart path builder; rewritten as segment flushing.
- Test helper typing (`ids<T>`) failed under `next build` type-check; widened to `readonly { id: string }[]`.
- Pattern D (recovery) and F (spend up, conversions down) were masked by sampling noise in the 7-day comparison; curves sharpened and verified by probe. Fatigue test rewritten from strict weekly monotonicity to regression slope + halves comparison.
- Arc Cloud trials swung +88% week over week on ~1 conversion/ad/day; volumes raised ~1.6× so moves read plausibly.

**Checks run:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests, 4 files), `pnpm build` (all routes dynamic). Dev server smoke test via Node fetch: all 7 routes 200, cookie switching verified for client and range.

**Known issues:**

- Responsive behaviour verified by rendering and class inspection only; no browser pass yet (user review pending).
- create-next-app made an automatic initial commit on `main` before the feature branch was created.

**Deferred:** real charts and interaction, custom date ranges, campaign drilldown, creative fatigue/winner signals, insight engine, Ask Analyst wiring, CSV import, auth, editable settings, dark theme, global search (⌘K), nav count badges.

**Next checkpoint:** user visual review at 1440 / 1280 / 390 / 360, then commit on `feat/foundation`.

---

## 2026-10-02 — APP 01 Design refinement + engineering docs (pass 2)

**Phase:** APP 01 — same scope; brief addendum with reference screenshots, DESIGN.md and logging requirements.

**Objective:** Translate the three reference screenshots into concrete system rules without expanding scope; write DESIGN.md, DEVLOG.md and DECISIONS.md.

**Decisions:** D-012 (design system documented as rules in DESIGN.md), D-013 (right rail as a fixed 340px region), D-014 (grouped navigation). Reference study recorded in DESIGN.md §19.

**Implemented:**

- Navigation grouped under "Analyse" and "Workspace" with 11px uppercase labels.
- KPI tile anatomy: label + functional icon, 26px numeral, comparison line with target hint, sparkline over a delta pill. `Delta` gained a `pill` variant (tiles only; tables keep text).
- `CardHeader` gained an `icon` prop; used on Overview, Insights and Settings cards.
- Overview right rail fixed at 340px from 1024px; trend card gained a two-key legend (selected period / earlier).
- `--text-3xl` set to 26px for numerals.
- DESIGN.md (root), docs/DEVLOG.md, docs/DECISIONS.md; README links to them.

**Reference sites:** fetched beui.dev, beautifului.dev, boardui.com, evilcharts.com, refero.design, open-design.ai, rewampui.com. Only boardui.com (KPI card structure, period switcher placement, right rail) and open-design.ai (DESIGN.md as portable concrete rules) influenced decisions; beui/beautifului confirmed patterns already in use (segmented filter chips, grouped sidebar). evilcharts is noted for APP 02. refero.design rendered no content server-side; rewampui.com returned 402.

**Checks run:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests, 4 files), `pnpm build` (all routes dynamic). Dev server smoke test: all 7 routes 200; grouped nav and new KPI tile markup confirmed in rendered HTML; client and range cookies verified.

**Deferred:** nav count badges, breadcrumb bar, global search, dark theme, chart period chips.

**Next checkpoint:** unchanged — user visual review, then commit.

---

## 2026-10-02 — APP 01 Visual review fixes (pass 3)

**Phase:** APP 01 — foundation-level refinements only; direction approved, no redesign, no APP 02 work.

**Manual review findings (user, desktop):**

- Overview KPI values clipped at the reviewed desktop width ("£...", "2....", "1...."). Cause: six tiles across with a side-by-side sparkline left under 150px for the numeral at 1440 and about 20px at 1280; the numeral carried `truncate`.
- Creatives page structure approved, but every placeholder thumbnail used the same centred icon on a flat tone, so the grid read as identical cards.
- Campaigns and sidebar approved; untouched.

**Decisions:** KPI readability outranks six-across; three tiles per row on desktop (two rows of three). Placeholder variety comes from an explicit `motif` on the thumbnail reference (seed data), not from parsing names. DESIGN.md §8a, §16 and §17 updated accordingly.

**Implemented:**

- `KpiTile`: numeral is `whitespace-nowrap` and never truncated; comparison line may wrap; sparkline + delta column shown from 640px, with the delta pill moving under the numeral below that so two tiles fit at 360.
- Overview KPI grid: `grid-cols-2 md:grid-cols-3` (was `xl:grid-cols-6`).
- `ThumbnailMotif` type (11 motifs) added to `CreativeThumbnail`; component rewritten to draw abstract SVG compositions in the tone ink on the tone fill, letterboxed, with a small type marker and aspect label in the large size.
- Every seeded creative (46) assigned a motif matching its format: Luxe Skin Co. renders 10 distinct motifs across 26 cards.

**Important files:** `src/components/ui/kpi-tile.tsx`, `src/features/overview/overview-kpis.tsx`, `src/components/ui/creative-thumbnail.tsx`, `src/domain/types.ts`, `src/data/seed/clients/*.ts`, `DESIGN.md`.

**Trade-offs:** Three-wide tiles are ~370px at 1440, wider than the reference dashboards' four-across tiles, but the only arrangement that keeps six numerals readable with the sparkline beside them. A four-plus-two split was rejected as visually unbalanced.

**Checks run:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests, 4 files, no new tests), `pnpm build`. Dev server smoke test: all 7 routes 200; rendered markup confirms the new grid classes, no `truncate` on numerals, the responsive sparkline column, 26 motif SVGs on Creatives, and the table scroll wrapper on Campaigns.

**Responsive (by class inspection, no browser):** 1440 and 1280 give 370px / 317px tiles; 390 and 360 give two tiles per row with the sparkline hidden and the pill under the numeral; creative grid is single column on phones; mobile sheet navigation unchanged; tables still scroll inside their card.

**Known issues:** no browser verification this pass; user review pending at 1440 / 1280 / 390 / 360.

**Deferred:** real creative imagery via import; interactive charts (APP 02).

**Next checkpoint:** user re-review, then commit on `feat/foundation`.

---

## 2026-10-02 — APP 01 Motion foundation (pass 4)

**Phase:** APP 01 — motion rules and foundation-level transitions only; no chart or number motion (APP 02).

**Objective:** Make state changes transition naturally across the shell with a small, tokenised motion system that respects reduced motion.

**Decisions:** D-015. Reference studied: transitions.dev (origin-aware menus, indicator-follows-selection, named properties, tokenised durations, reduced-motion guard). Three durations (140/200/300ms), three curves (enter/exit/standard); `transform`/`opacity` first; one documented layout exception (segmented indicator width).

**Implemented:**

- Tokens in `globals.css`: `--duration-quick|standard|deliberate`, `--ease-enter|exit|standard`, Tailwind defaults set to quick + standard ease, `duration-*` utilities, keyframes `fade-in/out`, `menu-in/out`, `sheet-in/out`, `rise-in`, `page-in`. Global `prefers-reduced-motion` rule collapses every transition and animation; keyframe utilities also use `motion-safe:` / `motion-reduce:animate-none`.
- `app/template.tsx`: route changes play a 200ms fade-and-rise; server-action re-renders do not.
- Client switcher: origin-aware menu enter/exit, `useOptimistic` selection so the trigger updates on click, pressed state.
- Mobile sheet: overlay fade, panel slides from the left (300ms in, 200ms out).
- Segmented control: a single indicator slides to the selection (`transition-[transform,width]`, standard), measured with a `ResizeObserver`; first paint has no transition; server markup falls back to colouring the selected button. Date preset control uses `useOptimistic` so the indicator moves before the server confirms, with `transition-opacity` on pending.
- Buttons: hover and press colours only (`accent-pressed` token added); no scale. Shared table rows, inputs and menu items gained `transition-colors`. Ask Analyst response card enters with `rise-in`.
- DESIGN.md §20 Motion (durations, easing, properties, reduced motion, menus, dialogs/panels, tabs, navigation/pages, buttons/hover, charts and numbers direction, loading, success/error, anti-patterns); §18 updated; `accent-pressed` added to the token table.

**Important files:** `src/app/globals.css`, `src/app/template.tsx`, `src/components/ui/segmented-control.tsx`, `src/components/shell/date-preset-control.tsx`, `src/components/shell/client-switcher.tsx`, `src/components/shell/mobile-nav.tsx`, `src/components/ui/button.tsx`, `src/components/ui/table.tsx`, `src/components/ui/input.tsx`, `src/features/ask/ask-analyst.tsx`, `DESIGN.md`, `docs/DECISIONS.md`.

**Trade-offs:** The segmented indicator animates `width`, a layout property, because a transform-only indicator would distort its corners; the element is 28px tall inside a 32px track, so the cost is negligible. Sorting/filtering motion in tables and creative-grid reflow were left for APP 02 by scope, even though the general list names them.

**Bugs found / fixed:**

- `className` prop dropped from the date control's `cn()` call (lint warning); restored.
- Tailwind's source scan picked up a literal `duration-300` from DESIGN.md prose and emitted a dead utility; the sentence was reworded.
- Primary pressed colour was first written as an arbitrary hex; replaced with the `accent-pressed` token.

**Checks run:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests, 4 files), `pnpm build`. Dev server smoke test: all 7 routes 200. Compiled CSS inspected: every `transition-duration` resolves to one of the three tokens or the quick default; no `transition-property: all`; no stray duration utilities; reduced-motion rule present; menu, sheet, rise and page keyframes present.

**Verification still owed to the user (browser):** no abrupt menus or panels, consistent durations, reduced-motion mode in OS settings, input stays responsive, no layout jank, no animation blocking input.

**Deferred (APP 02+):** KPI number tweens on period/client change, chart series reveal and update, selected-period band transition, table sort/filter transitions, insight card entrances, Ask Analyst answer reveal with real content, CSV import progress states.

**Next checkpoint:** user review of motion at 1440 / 1280 / 390 / 360 and with reduced motion enabled, then commit on `feat/foundation`.

---

## 2026-10-02 — APP 01 Motion system finalised (pass 5)

**Phase:** APP 01 — motion as a design-system requirement; foundation interactions only. Builds on pass 4.

**Objective:** Settle the motion vocabulary before commit: four-tier durations, three curves, documented rules for every control, explicit APP 02 chart and content motion rules (document only).

**Reference:** transitions.dev added as the motion reference. Principles taken: origin-aware menu open/close, a selection indicator that follows the active segment, named transition properties, tokenised durations, mandatory reduced-motion guard. Not taken: shake/error motion, showpiece reveals, any motion library. Intended feel recorded in DESIGN.md §20: modern, precise, fast, premium, restrained, analytical.

**Token decisions:** `--duration-micro` 120ms (colour changes; Tailwind default), `--duration-quick` 160ms (menus, overlay exit, pending opacity), `--duration-standard` 220ms (indicator slide, reveals, page enter, overlay enter, sheet exit), `--duration-deliberate` 300ms (sheet enter). Curves unchanged: enter `cubic-bezier(0.16, 1, 0.3, 1)`, exit `cubic-bezier(0.7, 0, 0.84, 0)`, standard `cubic-bezier(0.2, 0, 0, 1)`. Exits never longer than enters. CSS only; no animation library.

**Implemented this pass:**

- Tokens re-tiered as above; `duration-micro` utility added; all keyframes and controls pick up the new values through the variables.
- Client switcher: chevron takes `accent-strong` while the menu is open via a `group-data-[state=open]` variant (no rotation; the glyph is symmetric). Menu enter/exit, item highlight, optimistic selection and pressed state remain from pass 4.
- DESIGN.md §20 rewritten where needed: four-tier duration table with rationale, instant focus rings rule, menu and sheet details (Radix focus ownership, instant close on navigation), explicit APP 02 chart rules (animate to explain, morph on client/date change, no replayed entrances, previous period stays secondary, no bounce, no staggered showpieces), number tweens, and future content motion for insight cards, Ask Analyst results and CSV import progress. "No animation library" added to anti-patterns.

**Interactions covered (passes 4 and 5 together):** nav hover/active, client switcher open/close/selection/hover/focus/chevron, mobile sheet enter/exit with overlay, buttons hover/press, segmented controls and date presets (sliding indicator, optimistic selection, pending opacity), filters (same control), table row hover, inputs, Ask Analyst response reveal, page enter on route change. Static cards do not react to hover.

**Deliberately deferred to APP 02+:** chart series morph/reveal, selected-period band motion, KPI number tweens, insight card entrances, Ask Analyst answer reveal with real content, CSV import progress, table sort/filter transitions.

**Also fixed:** Tailwind's automatic source detection scanned the whole repository, so a class name quoted in the dev log produced a dead utility in the compiled CSS. Scoped detection to `src/` with `@import "tailwindcss" source("../")` in `globals.css`.

**Checks run:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests, 4 files), `pnpm build`; source audit for `transition-all` found none. Compiled CSS inspected: duration tokens 120/160/220/300ms present, every transition duration resolves to a token or the micro default, no `transition-property: all`, reduced-motion rule present. All 7 routes 200 on the dev server.

**Verification owed to the user (browser):** menus and sheet do not snap, durations feel consistent, OS reduced-motion removes movement, controls stay responsive during server round trips, no layout jank, nothing blocks input.

**Approval:** user approved the visual direction, the review refinements and the motion system on 2026-10-02. APP 01 is complete and committed on `feat/foundation`; APP 02 starts from a new entry.

---

## 2026-10-02 — APP 01.5 Visual direction pass

**Phase:** APP 01.5 — visual direction only. Architecture, data model, navigation structure, seeded data, tests and motion tokens unchanged. No features, no AI, no CSV, no APP 02.

**Problem identified:** The approved foundation read as a dashboard template. Every block was a bordered white card on a grey canvas; six identical KPI widgets with icons and pills sat beside each other; uppercase 11px labels appeared in tables, tiles, nav and asides; the chart lived inside a card with its own header; creatives looked like an ecommerce product grid with 64px thumbnails; the page header was a plain title. Nothing was wrong structurally, but nothing was composed.

**Visual direction chosen (A + C):** ultra-clean analytical composition with premium, X-grade finish. Concretely: a white page with the navigation rail as the only tinted region; open sections separated by whitespace and hairlines; containers only for tables, ranked lists and one aside; hierarchy from a 24px title, 13px semibold section headings and 24px numerals; blue reserved for selection, the charted series and the charted metric; sentence case everywhere except nav and menu group labels.

**References used:** the user's three screenshots re-read for composition (metrics directly above the chart as one analysis surface; grey rail against a white page; sentence-case table headers; a single contextual rail; the inline comparison sentence beneath a numeral). boardui.com for KPI-over-chart grouping; transitions.dev motion rules kept as is. beui.dev, beautifului.dev, evilcharts.com, refero.design and inspora.design were consulted earlier and did not change this pass beyond confirming the direction.

**Decisions:** D-016 (white page, open composition, containers only where grouping helps). DESIGN.md §1, §3, §4, §5, §7, §8, §8a, §8b, §9, §10, §13, §16–§19 updated.

**Changes:**

- Shell: page background white; rail and mobile sheet on `canvas`; 28px product mark with agency line; nav icons `ink-muted` at rest and `accent` when active; quieter rail footer; wider desktop gutters (40px).
- Primitives: `PageHeader` gains an eyebrow and a 24px tight title; `Card` gains `outlined`/`subtle` variants and loses its shadow; table headers become sentence-case 12px with 40px header and 44px rows; `LineChart` gets open framing, a 48px tick column, a baseline, a hairline-edged selected band and an end marker; `CreativeThumbnail` gains a `wide` 4:3 frame.
- Overview recomposed: eyebrow + title + period line; a grouped `KpiBand` (hairline-divided cells, 24px numerals, text deltas, target notes, 2px accent rule on the charted metric) replacing six `KpiTile`s; an open `PerformanceChart` (240px daily spend, 120px daily conversions) with a 300px `PeriodSummary` rail of computed facts (spend, conversions and cost, position against targets, largest spend increase, largest conversion decline, lowest CPA); a lower row with an open `SpendByCampaign` list (neutral bars) and a `TopCampaigns` table linking to Campaigns; an inline `AccountStrip` closing the page. `rankCampaignMovers` added to the analytics read models (pure ranking, no thresholds). Removed `KpiTile`, `OverviewKpis`, `TrendFrame`, `AccountStructure`.
- Campaigns: toolbar moved above the table container; sentence-case headers with sort arrows shown only on the active column or on hover; stronger name column with a quieter meta line; secondary numerics in `ink-secondary`; structure and density unchanged.
- Creatives: editorial cards with full-bleed 4:3 artwork on top, meta line, two-line title, four-column metric row with deltas beneath values, CTR with sparkline on the closing row, hover darkens the border only; 20px grid gaps.
- Other pages: client eyebrow in every header; Ask Analyst section heading in sentence case; otherwise untouched.
- Repository: `origin` set to https://github.com/HamidZ11/ads-analyst (empty remote, nothing pushed).

**Trade-offs:** The Overview rail appears from 1280px rather than 1024px so the chart keeps at least 630px at 1280; at 1024–1279 the summary stacks beneath the chart. Six band cells across need about 150px each, which holds at 1280 and 1440 only because the band carries no sparkline; the dominant chart carries the trend instead. Spend-distribution bars are grey so blue keeps a single meaning on the page.

**Bugs found / fixed:** none in code. `pnpm typecheck` once failed on duplicate generated files (`.next/types/… 2.ts`, Finder-style copies in the build cache, gitignored); they were gone on the next run and no duplicates exist in source.

**Verification:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests), `pnpm build`, `git diff --check` all pass. Rendered markup inspected: eyebrow and title, six-cell band with target notes, open chart with legend, period summary facts, top-campaigns table, 26 wide-frame creative cards, no uppercase table headers, hover-only sort arrows. Responsive by class inspection only: band 2 / 3 / 6 columns, rail from 1280, creatives 1–4 columns, tables still scroll inside their container, mobile sheet unchanged. No screenshots taken; user review pending at 1440 / 1280 / 390 / 360.

**Deferred:** chart interaction and motion (APP 02); KPI band cells becoming series selectors for the chart (APP 02); creative card drilldown; period-summary lines becoming insight findings (APP 05).

**Next checkpoint:** user visual review of Overview, Campaigns and Creatives, then commit on `feat/foundation`.

---

## 2026-10-03 — Design tooling and skill setup (preparation for the next visual pass)

**Phase:** between APP 01.5 and its rework. Tooling only: no production UI, chart, component or domain change. The uncommitted APP 01.5 working tree is unchanged by this pass.

**Why:** The APP 01.5 pass failed visual review. Before another redesign, future UI work needs critique tooling and concrete design references rather than generic prompting.

**Installed:**

- Impeccable v4.5.0 (engine v0.1.11) via `npx impeccable install --providers=claude --scope=project` into `.claude/skills/impeccable/` (SKILL.md, 46 reference playbooks, launcher scripts, command metadata, font index) and `.claude/agents/` (four Impeccable sub-agents). The project hook manifest landed in `.claude/settings.local.json` (SessionStart, PostToolUse on Edit/Write, Stop), which is machine-local and now gitignored. The 14 MB engine binary under `scripts/bin/` is gitignored; the launcher re-downloads the pinned version on first run.
- `PRODUCT.md` written from the init playbook using the product truths supplied in the brief (users, purpose, positioning, operating context, capabilities and constraints, brand commitments including the rejected looks, evidence on hand, principles, accessibility). No visual direction recorded there, per the playbook. No `.impeccable/config.json` written: image generation is unavailable, so code-first is the only build path and nothing is stored. Live mode not configured (requires separate consent).
- Two style skills from bergside/awesome-design-skills via `npx typeui.sh pull <slug> -p claude-code -f skill`, placed in `.claude/skills/design-premium/` and `.claude/skills/design-clean/` with unique names; the CLI writes every pull to one `design-system` folder, so each was moved and renamed. Their descriptions state that Ad Analyst tokens override theirs. The CLI's `.agents/` copy for other harnesses was removed.
- Hygiene: `.gitignore` gained Impeccable's official ignore block, `.claude/settings.local.json`, the engine binary directory and a nested-screenshot rule; `.prettierignore` excludes `.claude/` and `.impeccable/`; `eslint.config.mjs` ignores the same two trees (Impeccable ships browser scripts that are not project code); `.gitattributes` disables trailing-whitespace checks for vendored tool files so `git diff --check` reports only our own files.

**Research written:** `docs/design-research/design-md-references.md` (Vercel, Stripe, Coinbase, IBM Carbon, Cal.com selected from VoltAgent/awesome-design-md; Linear and HashiCorp set aside), `docs/design-research/current-ui-critique.md` (Impeccable critique playbook run inline as a declared degraded run; 24/40; one P0, three P1, two P2, one P3; detector: 0 findings; snapshot persisted to `.impeccable/critique/2026-10-02T23-04-43Z__src-app.md`), `docs/design-research/proposed-design-direction.md` (the stack, the direction, proposed DESIGN.md rule changes, sequence). `DESIGN.md` itself is untouched.

**Decisions:** The skills registry entries are shallow templates; only `premium` has compatible tokens and `clean` compatible intent, so two were installed and eight rejected with reasons. The critique's sub-agent requirement was not met because this session's operating policy forbids spawning agents without an explicit request; the report carries the degraded banner the playbook requires.

**Verification:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37), `pnpm build`, `git diff --check` all pass. `src/` differs from `HEAD` only by the pre-existing APP 01.5 changes. The `/impeccable`, `/design-premium` and `/design-clean` skills are on disk in the standard project location; this session's skill list was loaded before installation, so invocation is confirmed after a restart.

**Deferred:** merging the borrowed rules into DESIGN.md; the redesign itself (sequence in `proposed-design-direction.md`); answering the critique's four owner questions; `/impeccable live` setup.

**Next checkpoint:** owner reviews the three research documents and answers the critique questions; then the rework pass starts with `/impeccable layout` on the Overview.
