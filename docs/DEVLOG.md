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

---

## 2026-10-03 — APP 01.5 rejected; production UI restored to the APP 01 baseline

**Phase:** housekeeping between APP 01.5 and the next design pass. No redesign in this pass.

**What happened:** The APP 01.5 visual implementation failed manual review. It had been committed as `b6bc570` at the owner's request (together with the tooling pass `1c2095e`) and pushed, so "discard before commit" was no longer possible; the equivalent is a restoring commit on top, which keeps the history intact and needs no force push.

**Restored from `40eea2c`:** all of `src/` (33 files: the Overview page and its components, Campaigns table and page, Creatives card and grid, shell, sidebar, nav, product mark, page header, card, table, line chart, creative thumbnail, analytics queries, globals) and `DESIGN.md`. The five Overview components added in 01.5 (`kpi-band`, `performance-chart`, `period-summary`, `top-campaigns`, `account-strip`) are removed; `kpi-tile`, `overview-kpis`, `trend-frame` and `account-structure` return. `git diff 40eea2c -- src DESIGN.md` is empty.

**Preserved:** `.claude/skills/impeccable/`, `.claude/agents/`, `.claude/skills/design-premium/`, `.claude/skills/design-clean/`, `PRODUCT.md`, `docs/design-research/*`, `.impeccable/critique/*`, and the tooling-related changes to `.gitignore`, `.prettierignore`, `eslint.config.mjs` and `.gitattributes`. `.claude/settings.local.json` remains gitignored.

**History handling:** D-016 kept and marked rejected; D-017 records the rejection and restoration. The 01.5 and tooling entries above stand unchanged. A status line was added to the top of `current-ui-critique.md` noting that it assessed the discarded state and which findings carry over to the baseline. `PRODUCT.md` reviewed for visual-language leakage: the brand section now states the owner's palette and density constraints and the rejected looks as constraints only, with an explicit note that the visual system is decided in the design phase.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37), `pnpm build`, `git diff --check` all pass. One environmental fix: `tsconfig.json` now excludes `**/* [0-9].ts`, because duplicate copies of generated files (`.next/types/routes.d 2.ts`) kept appearing in the build cache, most likely conflict copies from iCloud or Finder while the dev server and a build both wrote that folder; they broke `tsc` twice in two days.

**Next:** restart Claude Code so the project-local skills load, then the redesign pass from the APP 01 baseline using Impeccable and the explicit reference system in `docs/design-research/`.

---

## 2026-10-03 — Visual System V2 specification (design only, no implementation)

**Phase:** between APP 01 (baseline restored in `3b56cdf`) and APP 01.6. Specification pass only: no change to `src/`, `DESIGN.md`, tokens or data. Nothing committed.

**Objective:** Define the next visual direction, "the analyst's instrument", as measurable rules before any code, and produce the APP 01.6 implementation plan.

**Output:** `docs/design-research/visual-system-v2.md` — visual thesis, principles, one 12-column page grid (8 + 4 at ≥ 1280), a nine-step type scale with named roles and tracking tokens, colour/surface rules with per-view budgets (≤ 2 outlined containers, ≤ 4 blue elements, ≤ 4 structural hairlines), the Overview composition (lead reading → metric strip as chart selector → one 280px chart, rail of spend concentration and largest changes, campaigns table below the fold, metadata footer), three-tier KPI hierarchy with a 5 % materiality threshold for colour, chart grammar (overlay of previous period by day index, dashed target line, end label, legend, tooltip and hover contract for APP 02), sidebar system (line-and-dot mark, quiet switcher, sentence-case groups, white active item with a 2px accent rule), Campaigns table rules, a creatives ledger replacing the card grid, motion applications, anti-patterns, structural component examples, what stays from APP 01, what must change, and the APP 01.6 plan with an Impeccable sequence and a critique gate (≥ 30/40).

**Decisions requested from the owner (§0 of the document):** lead metric rule (ROAS when a ROAS target exists, else cost per conversion); overlay chart vs trailing window; white page with grey rail and no static shadows; status dot and materiality colouring in tables; creatives as a ranked ledger; rail as 4 grid columns from 1280 (would supersede D-013); no uppercase labels (would amend D-014's label style); one chart and the account counts moved to a footer line. No DECISIONS entry yet; D-018 is written when the owner approves.

**Method:** Impeccable `shape`, `layout` and `typeset` playbooks against the APP 01 Overview with assessments run inline (declared in the document's Appendix B); `impeccable context --target src/app/page.tsx` loaded PRODUCT.md and DESIGN.md (no surface brief exists); `impeccable detect --scope layout` and `--scope type` on `src/` both returned zero findings. `design-premium` and `design-clean` used as precision and restraint checks; neither overrode PRODUCT.md or our tokens. The dataviz skill's mark, tooltip and one-axis rules informed the chart grammar; its palette was not adopted. `concept-seed` was not run: the direction is brief-pinned and the session is non-interactive. Example values are the live seeded Luxe Skin Co. figures from the dev server (27 Sep – 3 Oct 2026).

**Checks run:** `pnpm format:check` on the two changed documents. No build, lint or test changes (no source touched). Dev server was already running on :3000 and was used read-only.

**Deferred:** everything in the plan; DESIGN.md rewrite happens in APP 01.6 from the shipped result, not from this document.

**Next checkpoint:** owner reviews `visual-system-v2.md`, confirms or flips the §0 decisions, then APP 01.6 starts at step 1 (tokens and type).

---

## 2026-10-03 — APP 01.6 implementation rejected; production restored; `/design-lab` composition round

**Phase:** APP 01.6 attempt, its rejection, and the start of a composition-first round. Nothing committed.

**What happened:** Visual System V2 (`docs/design-research/visual-system-v2.md`) was implemented in full on the APP 01 baseline in the order the brief set (tokens and type, 12-column grid, sidebar, lead reading, selectable metric strip, overlay chart with target line and tooltip, four-column rail, lower campaigns module and footer line, campaigns table with status dot and paired change columns, creatives ledger, responsive classes). Checks were green (format, lint, typecheck, 58 tests, build) and every client × page × preset combination rendered clean. An isolated Impeccable critique sub-agent scored it 25/40 ("acceptable") with three P1 findings: the chart could not plot the lead metric, campaign names truncated where their meaning is, and cost against target was missing from the campaign tables. Manual review then rejected the screen outright: one giant empty bordered panel, dead whitespace, weak hierarchy, no true focal point, arbitrary KPI placement, an under-designed chart with a tiny line, colliding labels, lower content reading as raw rows, a rail concept that did not work, administrative typography. The score was not approval, and the written system was not enough.

**Restored:** `src/` and `DESIGN.md` to `40eea2c` (`git diff 40eea2c -- src DESIGN.md` is empty). Kept: Impeccable, `design-premium`, `design-clean`, `PRODUCT.md`, `docs/design-research/*` including `visual-system-v2.md`, this log and DECISIONS (D-018 to D-028 marked with their status; D-029 added).

**Built: `/design-lab`** (`src/app/design-lab/`, isolated from production navigation and components; `robots: noindex`; a fixed overlay above the production shell). Three self-contained 1440px Overview screens on the seeded Luxe Skin Co. data over the 14-day window (chosen so the chart has 14 points instead of 7):

- `data.ts` — one read model from the repository: six metrics with daily series split by period, best/worst day, targets as written ("3.5x", "£28"), campaigns with tier parsed from the Meta name, top movers in absolute units, spend by funnel stage, top creatives by ROAS, account structure. `tone()` colours only material (5%), directional change.
- `chart-geo.ts` — nice axis (≤ 4 intervals), smooth cubic paths, area and sparkline geometry. Static SVG; no interaction.
- `lab-sidebar.tsx` — a static sidebar in three tones (grey, white, pale blue) so each concept carries its own shell.
- **Concept A, Analytical command surface:** compact toolbar; four KPI cards with the ROAS card visually primary (tinted, 40px numeral) and target bars on the two target-bearing metrics, sparklines in every card; an 8/4 second row with a 340px ROAS chart (metric tabs, legend, dashed target, crosshair + tooltip, end-value pill, a four-cell summary strip beneath: average, best day, lowest day, days at target) and a rail of three panels (target status, spend concentration as a stacked bar plus legend, largest movers); a bottom row of a top-campaigns table and spend by funnel stage; a six-cell account strip. Structured panels used deliberately.
- **Concept B, Modern product analytics:** white page, white sidebar, 32px title; an editorial lead area with an 88px ROAS reading, its change and a target bar, four supporting KPIs with sparklines in a two-column ruled list; metric tabs with values as the chart's selector above a 1040×320 chart; two balanced lower modules (top campaigns with spend bars; "What changed" with 18px signed deltas); one metadata line. Spacing and rules instead of boxes, no large blank areas.
- **Concept C, Premium data workstation:** pale-blue workspace ground and sidebar, breadcrumb header; a hero panel with a 56px ROAS reading, target and previous-period tiles, a six-cell integrated KPI strip (selected cell tinted with a top rule) and a 380px chart with a 13% wash, best-day dark tooltip, low-day marker and end-value pill; a 300px rail (target gap panel on `accent-soft`, ranked changes, spend concentration); three dense mini-panels (cost per purchase vs target by campaign, top creatives by ROAS with placeholder artwork, spend by funnel stage); a compact campaigns table with over-target costs in red.

**Skills used:** Impeccable `shape` (brief-driven; three structures named by the owner), `layout` and `typeset` applied as checklists while composing (reading order, grouping, rhythm; role scale 11/12/13/14/16/18/20/28/32/40/56/88 across the three concepts), `bolder` read and applied to the lead readings (one decisive move per concept, neighbours quieted), `polish` as a single bounded inspection round (fixed: ISO dates on axes and tooltips, "3.50x" targets, unicode arrows replaced by lucide icons). `design-premium` as the precision bar (explicit states, tabular numerals, tracking that tightens with size); `design-clean` as the restraint check (one accent, no gradients, no glass, colour on material change only). Detector: zero findings on `src/app/design-lab`.

**Checks run:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests, 4 files; the V2 tests left with the discarded implementation), `pnpm build` (nine routes, all dynamic), `git diff --check`. `/design-lab` returns 200 with no leaked `undefined`/`NaN`. Duplicate `.next/types/* 2.ts` cache copies were deleted again before `tsc` (the known iCloud/Finder artefact).

**Trade-offs:** the concepts duplicate markup on purpose (no shared components until one is chosen); charts are static SVG with a mocked tooltip; the lab uses the 14-day preset regardless of the production cookie; mobile is ignored by instruction.

**Deferred:** selection of a concept; making the winner responsive; abstraction into `src/components/ui/`; `DESIGN.md` rewrite from the winner; reconciliation of D-018 to D-028; chart interaction (APP 02).

**Next checkpoint:** owner reviews http://localhost:3000/design-lab at 1440px and picks a direction. Nothing committed.

---

## 2026-10-03 — APP 01.7 production visual direction translated

**Phase:** APP 01.7 — production visual direction. Concept B is the production base; selected analytical depth from Concept C is integrated without creating a 50/50 hybrid. The design lab remains in place and is not exposed in navigation.

**Design translation:** B contributes the open white composition, restrained header, dominant lead metric, supporting KPI hierarchy, wide primary chart, quiet borders, and lower analytical sections. C contributes target status, contextual rail, spend concentration, and ranked campaign changes. A is deliberately excluded, along with equal prominent KPI cards, generic card grids, pale-blue full-canvas treatment, excessive panelisation, and AI-style decorative UI.

**Production changes:**

- Overview now uses the target-bearing lead metric policy (ROAS, then CPA, then spend), a strong current/previous/target relationship, five quieter supporting metrics, and a single selectable primary chart with current/previous day-index comparison, target line, end value, pointer tooltip, and keyboard left/right inspection.
- The chart is a focused client boundary using the existing SVG/data architecture; no chart dependency or motion library was added. Contextual analysis is beside the chart at wide desktop widths and stacks below when space is constrained.
- Lower Overview analysis is split into top campaigns and what changed, driven by a new material campaign mover read model. The existing repository and workspace cookie/action flow are unchanged.
- Campaigns keeps its dense table but moves labels toward sentence case and applies a 3% materiality threshold to low-signal delta colour.
- Creatives is now a ranked, filterable, sortable ledger with rank, artwork, identity/meta, spend, conversions, cost, ROAS/CPC, CTR, and change. The old ecommerce-like card grid is no longer used by the page.
- The shell now gives the page a white surface and reserves the cool-grey tint for the navigation rail/mobile sheet. Static Card shadows are removed; the page header and table hierarchy are stronger and sentence case is used in navigation/table labels.
- The known route-wrapper transform hazard is fixed by changing page entrance fill mode from `both` to `backwards`.

**Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (37 tests), `pnpm build --webpack`, and `git diff --check` pass. The default Turbopack build was attempted but hit an environment-only `Operation not permitted` process/port-binding panic while parsing CSS; Webpack compiled and generated all routes successfully. Read-only local route checks returned 200 for `/`, `/campaigns`, and `/creatives` and confirmed the new headings/content in server-rendered markup.

**Manual review status:** No browser surface was available in this session and no screenshots were taken, per the brief. Visual review at 1440, 1280, 390, and 360 remains the next required checkpoint. The motion/tooltip behaviour also needs direct browser inspection, including reduced-motion mode.

**Next checkpoint:** owner manually reviews production Overview, Campaigns, and Creatives; do not commit or push before that review.

---

## 2026-10-03 — APP 01.8 Overview visual correction

**Scope:** Correct the unapproved APP 01.7 execution within the chosen B/C direction. B retains the open composition, large lead reading and wide chart; C supplies target context, spend concentration and ranked movers. No sidebar, Campaigns or Creatives redesign, dependency addition, seed change or architecture rewrite.

**Chart root cause:** Reproduced Today in headless Chrome: the current and prior paths were only `M500.0 66.0` / `M500.0 72.4`. With one daily point and no point marker, neither path could draw a stroke. The SVG/container dimensions were valid; this was not a hidden CSS colour or clipping defect. Separately, the nice-axis search began at the peak's order of magnitude rather than one order below, allowing an unnecessarily large axis (e.g. 14 scaled to 40). The selector displayed the last day instead of the period aggregate. Pointer positions included the y-axis gutter; hover changed the end label; tooltips could escape the plot; missing-value areas bridged gaps.

**Chart corrections:** One-day ranges now query the existing trailing-series read model for 14 days of explicitly labelled context, with earlier dates grey and the final segment/selected day blue. No fabricated intraday observations or seed exceptions. Multi-day ranges keep current/previous overlays by day index. Extracted and tested the small geometry functions: tighter nice axes with headroom, count-safe ticks, gap-preserving fills and isolated-point markers. The plot has an explicit 320px desktop / 280px phone height, matching-date x labels, reserved gutters, stable final-day value, plot-relative bounded tooltips and keyboard inspection (arrows, Home/End, Escape). Metric buttons show period aggregates and use the client's vocabulary; client/preset changes reset chart state.

**Sparklines and KPI region:** The former two-day, independently normalised full-height strokes explained the arbitrary diagonals. Trends now use only the selected period, at 64×20px beside the numeric baseline; omitted for one-day presets, phones and the compact CTR row. Supporting KPIs use two open columns with horizontal separators, quieter small deltas and useful prior-value/target context. Removed redundant daily averages, repeated ROAS and “of impressions”. Preserved the 88px desktop lead metric; refined its tracking, baseline, previous-day grammar and target spacing. Missing values no longer imply a fabricated zero target gap or a comparison against a zero denominator.

**Rail and page balance:** Removed the chart's duplicate top margin and duplicated responsive rail markup. The 248px rail sits beside the chart from 1400px; at 1280px its sections sit below the full-width plot, stacking on phones. Target status leads, concentration is quieter, campaign identities get two lines plus full-name titles, and mover deltas align right. Non-revenue clients' lower campaign summaries show CPA rather than meaningless ROAS.

**Design guidance:** Used project-local Impeccable layout/typeset/polish and premium/clean execution guidance. Source and rendered assessments found excess cell dividers, detached sparkline baselines, a cramped selector/legend and unnecessary chart spacing. Layout/type detector scans returned no findings; human B/C composition took precedence over generic style defaults. No new theme, boxes or font system. DESIGN.md §21 records only the durable chart/context/spacing rules.

**Browser verification:** Isolated headless Chrome against the running local app, with screenshots visually inspected (not source-only). All 60 client × preset × viewport combinations passed: Luxe Skin Co., Peak Fitness and Arc Cloud; Today, Yesterday, 7D, 14D and 30D; 1440, 1280, 390 and 360px. Actual plot sizes: 736×320, 856×320, 262×280 and 232×280 respectively. Checked every metric selector, finite visible current/grey paths, target bounds, tooltip bounds at left/middle/right, stable end value, keyboard inspection/dismissal, sparse sparkline omission and consistent dimensions. Zero page overflow and zero browser runtime errors in that matrix. Full-page captures and tooltip captures are temporary verification artifacts, not project assets. Manual visual approval remains the owner's decision.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50 tests, including 13 chart regression cases) and `git diff --check` pass. Final smoke checks also exercised the real date server actions at all four widths. `pnpm build` was run but Turbopack again failed on an environment port-binding `Operation not permitted` while processing CSS, including with escalation. `pnpm build --webpack` compiled and generated all routes successfully. This is a qualified build result, not a claimed default-build pass.

**Working tree / next checkpoint:** Existing dirty work preserved. No commit or push. Stop for manual Overview review at the four requested widths.

---

## 2026-10-03 — APP 01.8 manually approved and locked

**Approval:** The owner confirmed that the current Overview passed manual visual review and authorised committing and pushing the complete state. The Overview, including Top campaigns / What changed, is locked. No application or visual changes were made during this checkpoint; only approval status was recorded in DESIGN.md, DECISIONS.md (D-032) and this log. The design lab remains as an unlinked reference. No sidebar redesign is in scope.

**Final verification:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50 tests), `pnpm build --webpack` and `git diff --check` passed. Webpack is explicitly accepted for this checkpoint; the previously documented Turbopack environment limitation is unchanged. The commit includes the APP 01.8 Overview implementation, chart geometry regression tests, retained design lab and page-animation `backwards` fill fix.

**Checkpoint:** Commit the verified approved state on `feat/foundation`, push normally to the existing `origin`, then stop. Further visual changes require a new explicit brief.

---

## 2026-10-03 — Sidebar visual exploration: `/sidebar-lab`

**Phase:** sidebar-only exploration beside the locked APP 01.8 Overview (`8ba6437`). No production file changed; the only addition is the unlinked `src/app/sidebar-lab/` route. Nothing committed.

**Built:** three static sidebar concepts, each rendered beside the real approved Overview (the production `PageHeader` and `OverviewAnalytics` on a fixed Luxe Skin Co. workspace built without cookies, clipped to a 1440×760 first viewport; the preset control is a static replica so the lab cannot change the production cookie). Frames stack vertically inside the lab portal; the navigation config and lucide icons are the production ones.

- **Concept A — Quiet analytical rail:** pale `canvas` rail, 18px mark with the wordmark and the agency in a muted line beneath, a borderless client row (pale initials, name, "Ecommerce · GBP", chevrons on hover), 32px items with 1.5-stroke faint icons, groups separated by spacing only, active item as `accent-strong` text, `accent` icon and a 2px rule at the rail's edge, a low-contrast footer with no divider.
- **Concept B — Premium workspace nav:** 28px ink mark with a 14px wordmark and agency line, a labelled client control on a white bordered surface (pale-blue initials with a connection dot), groups divided by a hairline, 34px items whose active state is a white bordered surface with ink text and a blue icon, a white footer tile with the data state and a chevron.
- **Concept C — Compact professional tool:** 224px white rail, a 44px header row with the mark, wordmark and agency on one line, a 36px one-line client row with "Ecom · GBP", 28px items at 15px icons with no gaps, active item as a `surface-active` fill with ink text and a 2px rule, a single 36px footer line.

**Skills used:** Impeccable `shape` (three directions set by the brief), `layout` and `typeset` as checklists (rail rhythm 32/34/28px; hierarchy product → agency → client → navigation; 13px items, 12px group labels, 11px in C), `polish` as one bounded inspection round through a Chrome DevTools probe (overlay on body at 1440×900, three frames at 1440×760, sidebars 240/240/224px, active items 32/34/28px with the intended colours, footers pinned, no horizontal overflow, no console exceptions). `design-premium` as the precision bar; `design-clean` as the restraint check. Detector: zero findings on `src/app/sidebar-lab`.

**Known lab-only compromise:** rendering the real Overview three times duplicates its three element ids (`lead-performance-title`, `performance-chart-title`, `chart-context`) on one page. Accepted for a temporary comparison page; not a production concern.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50 tests), `pnpm build --webpack` (routes include `/sidebar-lab`), `git diff --check`.

**Next checkpoint:** owner reviews http://localhost:3000/sidebar-lab at 1440px and selects a concept; production sidebar work follows a separate brief.

---

## 2026-10-03 — Sidebar production implementation (Concept B)

**Phase:** production sidebar, translated from the manually selected `/sidebar-lab` Concept B. Beside the locked APP 01.8 Overview (`8ba6437`); no Overview, Campaigns, Creatives or other page file changed. Nothing committed.

**Exploration and selection:** `/sidebar-lab` rendered three concepts beside the real Overview (see the previous entry). The owner chose Concept B — Premium Workspace Nav; Concept A — Quiet Analytical Rail was second; Concept C — Compact Professional Tool was rejected. Recorded as D-033.

**Implementation (shell files only):**

- `product-mark.tsx`: 28px ink mark, 14px 600 wordmark, agency in a 12px muted line beneath.
- `sidebar.tsx`: product header (16px padding), a 12px "Client" label over the switcher, navigation 20px below, and a white footer tile (hairline border, 6px radius) with a status dot, "Meta Ads · demo dataset" and the live coverage line. No chevron: the footer has no action.
- `client-switcher.tsx`: 44px white control with a 1px border and 6px radius; 28px pale-blue initials with an 8px connection dot when metrics are loaded; name 13px, type · currency 12px; chevrons that darken on hover and open; hover strengthens the border. Radix radio menu, check indicator, `useOptimistic` selection, pending opacity and the compact mobile variant are unchanged.
- `client-mark.tsx`: new `lg` size (28px), `tone="soft"` (pale blue) and `connected` dot. The default solid tone is untouched, so the Clients table's selected mark is unchanged.
- `nav-links.tsx`: 34px rows with 2px gaps, 12px sentence-case group labels in `ink-muted`, one hairline before Workspace (20px above, 16px below). Active row: white surface, hairline border, ink text, blue icon at 2 stroke. Inactive: transparent border, `ink-secondary` text, `ink-muted` icon at 1.5 stroke. Hover: `surface-active` and ink text. Motion stays on `transition-colors` with the micro token.

**Deviations from the lab:** none visual. The lab's footer chevron was dropped (no action behind it); the connection dot is driven by real coverage rather than hard-coded; the "Client" label is plain text (the trigger keeps its `aria-label`).

**Render verification (Chrome DevTools, headless, real routes):** at 1440 and 1280 the rail is 240px on `canvas`; mark 28px at (16, 21); wordmark 14px/600; agency 12px muted; switcher 215×44 white with the `border` colour and 6px radius, initials 28px pale blue with the dot; "Overview" active row 215×34 white with hairline, ink text, blue icon; inactive rows `ink-secondary` with muted icons; all rows 34px with 2px gaps; icons share x = 23 and labels x = 49; group labels 12px muted, no text transform; Workspace hairline 20px below the last Analyse row; hover on Campaigns gives `surface-active`; footer tile 215×48 white, hairline, green dot, no chevron, 12px above the bottom; main starts at x = 240; no horizontal overflow; the Overview lead reads "Return on ad spend". A simulated long client name truncates with an ellipsis inside the 215px control. At 390 and 360 the desktop rail is hidden, the 48px bar shows the mark and a 153px compact switcher, the sheet opens at 280px on `canvas`, focus lands inside (close button), the same active row and 34px rhythm render, the footer tile sits 12px above the bottom, nothing overflows, Escape closes the sheet and focus returns to the "Open navigation" trigger.

**Functional verification:** curl matrix of 3 clients × 7 routes: all 200, `aria-current` on the correct link, the switcher naming the right client, the footer present. Through the real menu at 1440: opening shows the agency label and three radio items with Luxe checked and focus inside the menu; choosing Peak Fitness closes the menu, updates the trigger to "Peak Fitness · Local lead generation · GBP", re-renders Campaigns as "Peak Fitness · 5 campaigns" with the active item intact; switching back to Luxe works. No console errors or exceptions in any run.

**Docs:** DESIGN.md §6, §7 and §10 rewritten with the durable sidebar rules; D-033 added; this entry.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50 tests), `pnpm build --webpack` (ten routes), `git diff --check`.

**Next checkpoint:** owner's manual visual review of the production sidebar beside the Overview at 1440, 1280, 390 and 360; `/sidebar-lab` stays unlinked until then. No commit or push.

---

## 2026-10-03 — Sidebar locked and pushed; Campaigns exploration started in `/campaigns-lab`

**Sidebar checkpoint:** the production sidebar (Concept B translation) passed manual visual review and was committed as `139666c` "Polish and lock Ad Analyst sidebar" and pushed to `origin/feat/foundation` (`8ba6437..139666c`, no force). The commit includes the shell files, DESIGN.md §6/§7/§10, D-033 and the unlinked `/sidebar-lab` reference. Hover and click animation polish is deferred to final product polish. All checks were green before the commit (format, lint, typecheck, 50 tests, Webpack build, whitespace).

**Campaigns exploration (uncommitted):** `src/app/campaigns-lab/` renders three concepts at 1440px, each inside the approved shell: the real `ProductMark` and `ClientSwitcher`, a replica of the approved navigation with Campaigns active (the production `NavLinks` reads the lab's own URL), the approved footer tile, and the production `PageHeader` with a static preset replica. Data is the production `getCampaignRows` for a fixed Luxe Skin Co. workspace (7 days), plus per-campaign daily series, cost-against-target and account totals computed from the same metrics. Nothing is classified; `rankCampaignMovers` (existing deterministic ranking) supplies the "largest movement" fact.

- **Concept A — Refined Analytical Table:** production header; toolbar of search, All/Active/Paused segment, count and a quiet "Columns" affordance; one framed table with a tinted header, 48px rows pairing each metric with its change beneath, status as a dot and word, cost/ROAS/CTR in secondary ink, a tinted totals row and a one-line comparison note.
- **Concept B — Campaign Performance Ledger:** underline status tabs with counts (the Overview's tab idiom), search and a sort label right; an open table with a two-tier header grouping Delivery / Outcome / Efficiency by gutters and short rules; 56px entries with a 14px identity line, a metadata line carrying the status dot, 14px semibold spend and purchases, "from …" previous values beneath each change, the target beneath cost; an aligned account line as the footer.
- **Concept C — Campaign Command Table:** a four-cell strip of facts (spend and purchases with change, campaigns over the £28 target, the largest movement from the mover ranking); search, segment and "Sorted by spend"; a framed table with 52px rows carrying a hollow dot for paused, a 56×18 daily-conversions sparkline, and the cost's position against target as a 56px bar with a target tick and an "over/under" sentence; a totals row stating the share of spend over target.

**Skills:** Impeccable `shape` (three briefed directions), `layout` and `typeset` as checklists (hierarchy identity → values → changes → metadata → status; 13/14px values, 12px changes, rows 48/56/52), `polish` as one inspection round through a Chrome DevTools probe (three frames at 1440px, sidebars 240px with Campaigns active on a white row, tables 1116–1118px inside the 1198px main, uniform row heights, no overflow, no leaked values, no console errors; coloured change values 6 / 6 / 13 of 36–45 per concept). `design-premium` as the precision bar; `design-clean` as the restraint check. Detector: zero findings on `src/app/campaigns-lab`.

**Production untouched:** `/campaigns` and every other page are unchanged; the working tree holds only the untracked lab. No DESIGN.md or decision change until a concept is selected.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50), `pnpm build --webpack` (eleven routes), `git diff --check`.

**Next checkpoint:** owner reviews http://localhost:3000/campaigns-lab at 1440px and selects a concept. The lab is not committed or pushed.

---

## 2026-10-03 — Campaigns production implementation (Concept B with C's target context)

**Phase:** APP 01.9, production Campaigns, from the manually selected `/campaigns-lab` concepts. The Overview and sidebar are locked and untouched. Nothing committed.

**Lab comparison and selection:** three concepts were rendered beside the approved shell. The owner chose Concept B — Campaign Performance Ledger as the base (spacing, scanning, row hierarchy, long names, grouping, open composition, relationship with the Overview), Concept C — Campaign Command Table for its cost-against-target relationship and account summary only, and rejected Concept A. Recorded as D-034.

**Production translation (`src/features/campaigns/campaigns-table.tsx`, new `campaigns-summary.tsx`, `src/app/campaigns/page.tsx`):**

- Header: the Overview's language with "Luxe Skin Co. · 9 campaigns · 8 delivering" and the two-line period block beside the preset control.
- Account summary (from C, in B's language): one open row under a hairline with spend and outcomes plus change, campaigns over the cost target (or delivering campaigns when a client has no cost target), and the largest movement from the existing `rankCampaignMovers` ranking. 16px values, no cards.
- Toolbar (B): underline tabs All 9 · Active 8 · Paused 1 with real filtering, a 240px search, and a "Sorted by Spend" readout driven by the real sort state.
- Ledger (B): Delivery / Outcome / Efficiency group labels over short rules, 32px group gutters (24px below 1400px), 56px rows, 14px identity line with a metadata line carrying the status dot (hollow for paused), 14px semibold spend and outcomes, change with "from £1,374" beneath, cost at 13px with C's target relationship beneath in semantic colour, ROAS and CTR quiet, an aligned totals row for the visible campaigns.

**Deviations, all deliberate:** no micro-trend sparkline (B already carries direction and the previous value; a 7-point line next to "from 76" read as clutter); no "Columns" control (no such behaviour exists); the lab's static sort label became a live readout; the roadmap note was replaced by the comparison note; the ledger uses a 5% materiality threshold per the brief while the Overview's supporting metrics keep 3% (reconciliation deferred to global polish); the identity column is capped per breakpoint and numeric columns are pinned to their content width so the ledger fits 1280 without scrolling.

**Render verification (Chrome DevTools, real routes):** 1440: table 1105px in a 1105px wrapper with no local scroll, identity column 409px, 56px rows, group gutters 32px, summary values 16px in four columns, three group headers, target lines ("£110.83 over target", "£6.24 under target"), two over and five under target coloured, six coloured changes, totals aligned; no page overflow. 1280: table and wrapper both 945px, identity 273px, gutters 24px, no scroll. 390 and 360: summary in two columns, the ledger at 880px scrolling inside its wrapper (522 / 552px), the identity column sticky at 207px with a hairline edge and an opaque white background, no page overflow. Interactions at 1440: the Paused tab filters to one row and hides the totals, searching "retinol" filters to one row with the focused input's accent border, clicking Purchases sorts descending (82, 57, 43) then ascending, the readout follows, and row hover tints to `surface-subtle`. No console errors or exceptions.

**Functional matrix (curl):** three clients × five presets (7d, 14d, 30d, today, yesterday): all 200; headers read Purchases / Cost per purchase, Leads / Cost per lead, Trials / Cost per trial; target lines use each client's currency and target; no leaked values.

**Skills:** Impeccable `layout` and `typeset` as checklists (hierarchy identity → values → changes → metadata → status; 14/13/12px roles), `polish` as two bounded inspection rounds through the probe (the second fixed the 1280 scroll and the phone sticky-column width). `design-premium` as the precision bar; `design-clean` as the restraint check.

**Docs:** DESIGN.md §22 (Campaigns ledger rules), D-034, this entry.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50), `pnpm build --webpack`, `git diff --check`.

**Next checkpoint:** owner's manual visual review of `/campaigns` at 1440, 1280, 390 and 360 for the three clients; `/campaigns-lab` stays unlinked until then. No commit or push.

---

## 2026-10-03 — Campaigns locked and pushed; Creatives exploration started in `/creatives-lab`

**Campaigns checkpoint:** the production Campaigns ledger passed manual visual review (the one Safari rendering report was browser cache and cleared with a hard refresh; no code changed for it) and was committed as `c8951ec` "Polish and lock Ad Analyst campaigns" and pushed to `origin/feat/foundation` (`139666c..c8951ec`, no force). The commit includes the ledger, the account summary, the page, DESIGN.md §22, D-034 and the unlinked `/campaigns-lab` reference. All checks were green before the commit; the Overview and sidebar diffs against HEAD were empty.

**Creatives exploration (uncommitted):** `src/app/creatives-lab/` renders three concepts at 1440px inside the approved shell (the shared lab frame now takes an `activeHref` so its replica navigation shows Creatives as current; the production mark and client switcher are real). Data is the production `getCreativeRows` for the fixed Luxe Skin Co. workspace (7 days) plus facts from the same metrics: per-creative daily spend and conversions across both periods, ad-level spend with each ad's campaign, cost against the client's target, and a spend / outcome / ROAS breakdown by type. The existing synthetic artwork is used in fixed boxes so rows keep one rhythm whatever the asset's aspect.

- **Concept A — Creative Performance Ledger:** the Campaigns ledger applied to creatives: rank, 56×70 artwork inside the identity cell with a two-line title and "Video · 2 ads · 1 campaign", Delivery / Outcome / Efficiency groups, 72px entries, spend and purchases at 14px semibold with change and the previous value beneath, cost with the target relationship, ROAS, and CTR with its change and one 64×20 trend across both periods (grey then blue). Undelivering creatives collapse to one muted cell; totals row for all 26.
- **Concept B — Creative Analysis Split View:** a 400px ranked list (40×50 artwork, name, type and ad count, spend and ROAS right-aligned, selected row on `surface-subtle` with a 2px rule) beside a detail pane: 168×210 artwork, rank line, 18px title, the headline, five open metrics with change and target context, a daily spend chart with the previous period overlaid day by day, "Used in" with ad-level spend per campaign, and a now / before / change table. Type filter, sort and selection are real (client component).
- **Concept C — Analytical Creative Board:** open composition: a three-cell type breakdown (share of spend, spend, purchases, ROAS per type), the two leaders by spend as full-width entries with 120×150 artwork and five metrics including a CTR trend, then the remaining delivering creatives as horizontal entries with 72×90 artwork and four metrics in two ruled columns, and a quiet strip for creatives with no delivery.

**Skills:** Impeccable `shape` (three briefed directions), `layout` and `typeset` as checklists (hierarchy identity → spend / ROAS / cost → conversions → CTR → change → metadata; 18/16/15/14/13/12px roles), `polish` as one inspection round through a Chrome DevTools probe (three frames, Creatives active in the sidebar, A rows 72px with 56×70 artwork, B list rows 64px, no overflow, no leaked values; the round fixed A's 87px rows, duplicate keys in B's "Used in" list and the lowercase "ROAS" in B's rank line). `design-premium` as the precision bar; `design-clean` as the restraint check. Detector: zero findings on `src/app/creatives-lab`.

**Production untouched:** `/creatives` and every other page are unchanged; the working tree holds the untracked lab and the one-prop change to the campaigns lab frame. No DESIGN.md or decision change until a concept is selected.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50), `pnpm build --webpack` (twelve routes), `git diff --check`.

**Next checkpoint:** owner reviews http://localhost:3000/creatives-lab at 1440px and selects a concept. The lab is not committed or pushed.

---

## 2026-10-03 — Creatives production implementation (Concept C board with Concept B inspector)

**Phase:** APP 01.10, production Creatives, from the manually selected `/creatives-lab` concepts. The Overview, sidebar and Campaigns are locked and untouched. Nothing committed.

**Lab comparison and selection:** three concepts were rendered inside the approved shell. The owner chose Concept C — Analytical Creative Board as the page (type breakdown, ranking, leaders with prominence, open composition, its own identity beside the Overview), Concept B — Creative Analysis Split View for the inspection interaction only, and rejected Concept A as a Campaigns ledger with thumbnails. Recorded as D-035.

**Production translation (`src/features/creatives/board-data.ts`, `creative-board.tsx`, `creative-inspector.tsx`, `creative-artwork.tsx`, `src/app/creatives/page.tsx`; `creative-grid.tsx` and `creative-card.tsx` removed):**

- Header in the product language: "Luxe Skin Co. · 26 creatives across 9 campaigns", the two-line period block and the real preset control.
- Type tabs with counts (All 26 · Image 11 · Video 9 · Carousel 6) as underline buttons with `aria-pressed`; real filtering. "Ranked by" is a real select (spend, outcomes, cost per conversion lowest first, CTR, ROAS when tracked) with a "n delivering · m idle" count.
- Type breakdown (C): three hairline-divided cells with count, share of spend at 18px, spend, outcomes and ROAS, computed from the real metrics over all creatives; the filtered type's cell takes a `surface-subtle` tint.
- Leaders (C): the first two by the active ranking as full-width entries with 120×150 artwork, rank and metadata line, 16px title, and five 18px metrics (spend, outcomes, cost with target relationship, ROAS with change, CTR with change and one 64×20 two-period trend when at least six readings exist).
- Remaining creatives (C): 72×90 artwork, a two-line 14px title, four 15px metrics (spend, outcomes, cost with target relationship, ROAS), in two ruled columns from 1400px and one column below. Idle creatives: a quiet "No delivery this period" strip with 20×24 artwork and muted names.
- Selection: every delivering entry is a stretched button with `aria-pressed`; selected entries sit on `surface-subtle` with a 2px accent rule and an accent rank numeral.
- Inspector (B): a non-modal Radix dialog on the right, 440px from 640px and full width below, with the context line ("#3 by spend · Video · 2 ads · 1 campaign"), title, 120×150 artwork beside the seeded headline and spend / outcomes, cost with target relationship, ROAS and CTR with change, a 120px daily spend chart built on the Overview's chart geometry with the previous period aligned by day (a one-day period shows a sentence instead), "Used in" with ad-level spend per campaign from the real lineage, and a now / before / change table. Opens on selection, updates when another entry is selected, closes on Escape or its button, and returns focus to the entry explicitly (a mouse click does not focus a button on macOS, so Radix alone restored focus to the body).

**Deviations, all deliberate:** no permanent split (B's layout) and no overlay dimming, so the board stays legible behind the inspector; no sparklines beyond the leaders' CTR trend; the inspector reuses the existing `rise-in` and `fade-out` keyframes rather than adding a right-sheet keyframe to the global motion tokens; the roadmap note on the old page was replaced by the comparison note; the 5% materiality threshold matches Campaigns (the Overview's supporting metrics still use 3%, reconciliation deferred to global polish).

**Render verification (Chrome DevTools, real route):** 1440: no page overflow, tabs and counts, breakdown "Image · 11 · 26% of spend · £1,897 · 86 purchases · 3.35x ROAS" (and Video 49%, Carousel 26%), leaders with 120×150 artwork and five metrics, 22 remaining entries in two columns with 72×90 artwork and four metrics, two idle creatives, 22 target lines. 1280: identical with the remaining entries in one column. 390 and 360: layout viewport equals the device width (an earlier 426px zoom from the unwrapped toolbar was fixed), breakdown stacked, entries single-column, inspector full width with a close button, no overflow. Interactions: the Video tab filters to 8 entries and tints its breakdown cell; ranking by ROAS retitles "Leading by ROAS" and renumbers; selecting an entry opens the 440px inspector with focus on its close button, the correct title, context line, chart, two usage rows and five comparison rows; selecting another entry while open switches the inspector; Escape and the close button both close it and return focus to the entry; Enter and Space open it from the keyboard; the focus ring is the accent outline. No console errors or exceptions.

**Functional matrix (curl):** three clients × four presets (7d, 14d, 30d, today): all 200; Purchases / Cost per purchase, Leads / Cost per lead, Trials / Cost per trial; three type cells and target lines in each client's currency; no leaked values and no cross-client data (creative counts 26 / 11 / 9).

**Observation on a locked surface (not changed):** in Chrome's phone emulation the Campaigns page lays out at a 588px viewport at 390 and 360, i.e. the phone zooms out slightly, although no element outside the ledger's scroll container exceeds the screen; the 880px minimum-width table inside its scroll wrapper appears to influence the initial scale. Creatives and the Overview lay out at the device width. Flagged for the later global polish pass.

**Skills:** Impeccable `layout` and `typeset` as checklists (hierarchy identity → spend and efficiency → outcomes → CTR and changes → metadata), `polish` as two bounded inspection rounds through the probe (the second fixed the phone toolbar overflow and the focus return). `design-premium` as the precision bar; `design-clean` as the restraint check. Detector: zero findings on the Creatives files.

**Docs:** DESIGN.md §23 (Creatives board and inspector rules), D-035, this entry.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50), `pnpm build --webpack`, `git diff --check`.

**Next checkpoint:** owner's manual visual review of `/creatives` at 1440, 1280, 390 and 360 for the three clients, including the inspector; `/creatives-lab` stays unlinked until then. No commit or push.

---

## 2026-10-03 — Creatives locked and pushed; Insights exploration started in `/insights-lab`

**Creatives checkpoint:** the production Creatives board and inspector passed manual visual review and were committed as `aac6548` "Polish and lock Ad Analyst creatives" and pushed to `origin/feat/foundation` (`c8951ec..aac6548`, no force). The commit includes the board, the inspector, the page, DESIGN.md §23, D-035, the unlinked `/creatives-lab` reference and the one-prop change to the shared lab frame. All checks were green before the commit; the Overview, sidebar and Campaigns diffs against HEAD were empty.

**Insights exploration (uncommitted):** `src/app/insights-lab/` renders three Insights concepts and one empty-state frame at 1440px inside the approved shell (real product mark and client switcher, replica navigation with Insights current, the static preset control). Production `/insights` and the insight engine are untouched: the lab's findings are **fixtures**. `fixtures.ts` pins eight findings to the scenarios the seed documents (by campaign, ad and creative id) and computes every figure from the real daily metrics of the fixed Luxe Skin Co. workspace (27 Sep – 3 Oct 2026 against 20 – 26 Sep) through `getCampaignRows`, `getCreativeRows` and ad-level `queryMetrics`, so the wording is true for that period; only the choice of scenarios is fixed. Nothing in the lab detects anything, and nothing in it is imported by production.

| Fixture                                                                                          | Detector represented                       | Priority    | Entity                                       | Evidence shown                                                                                            | Suggested action                                                                             |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Autumn Reset Sale spent 31.4% more while purchases fell 43.5%.                                   | Campaign deterioration                     | High impact | Campaign · Prospecting · Advantage+ Shopping | Spend £1,805 +31.4%; purchases 13 −43.5%; cost per purchase £138.83 from £59.72; target £28, £110.83 over | Review budget allocation and inspect the ads driving the decline.                            |
| £638 was spent on Overnight Repair Cream with no purchases in the selected period.               | Zero-conversion spend                      | High impact | Campaign · Prospecting · Lookalike 5–10%     | Spend £638 +2.7%; purchases 0 (0 previous); CTR 1.03%                                                     | Confirm conversion tracking for this campaign, then consider pausing or reducing its budget. |
| Cost per purchase in Vitamin C Brightening rose 60.5% to £51.99.                                 | CPA spike                                  | High impact | Campaign · Prospecting · Interests           | Cost per purchase £51.99 from £32.39; purchases 24 −36.8%; spend £1,248 +1.4%; target £28, £23.99 over    | Inspect the ads and creatives in this campaign for the source of the increase.               |
| Collagen Night Mask testimonial has the campaign's lowest cost per purchase on 10% of its spend. | Underfunded winner                         | Opportunity | Ad · Anti-Ageing Collection                  | Spend £77 (10% of campaign); cost per purchase £6.39 vs campaign £19.58; ROAS 12.72x vs 4.01x; ad table   | Consider shifting budget toward this ad within the campaign.                                 |
| Cart Abandoners 7D retargeting more than doubled purchases on slightly lower spend.              | Campaign improvement                       | Opportunity | Campaign · Retargeting                       | Purchases 57 +119.2%; spend £497 −5.4%; cost per purchase £8.72, £19.28 under target                      | Consider restoring or increasing budget while efficiency holds.                              |
| Retinol Renewal Serum absorbed 12.9% more spend while holding cost per purchase under target.    | Scaling winner                             | Opportunity | Campaign · Prospecting · Broad               | Spend £1,784 +12.9%; purchases 82 +7.9%; cost per purchase £21.76, £6.24 under target; ROAS 3.38x +1.5%   | Consider a further measured budget increase while cost per purchase stays under target.      |
| Vitamin C – UGC Before/After shows a fatigue pattern: CTR fell 19.4% on stable spend.            | Creative fatigue proxy / CTR deterioration | Watch       | Creative · Video · 2 ads · 1 campaign        | CTR 0.87% −19.4%; spend £733 +3.9%; cost per purchase £66.66 +22.8%; impressions in the comparison table  | Refresh or test a replacement creative in this ad set.                                       |
| 65% of spend sits in three campaigns.                                                            | Spend concentration                        | Watch       | Account · 8 delivering campaigns             | Top-3 share 65% of £7,420; Autumn Reset Sale 24%, Retinol 24%, Vitamin C Brightening 17%; share bar       | Monitor dependence on these campaigns before the next budget decision.                       |

Each finding separates what happened (headline), where (entity line), evidence (three or four metrics with change against the previous period or the target), why it matters (the suggested action's premise) and the suggested action, plus a "why this was flagged" sentence in the detector's own terms. Wording is observational ("spent more while purchases fell", "shows a fatigue pattern", "This is a fatigue proxy, not a measured cause"); no cause is asserted, no score or traffic light appears, and no action can be executed from the page. ROAS decline is represented inside the deterioration and CPA-spike findings rather than as a ninth item.

- **Concept A — Priority Analysis Feed:** one ranked feed. Underline priority tabs with counts (All 8 · High impact 3 · Opportunities 3 · Watch 2), "Ranked by priority", then open rows: a 140px column with the priority (6px dot and word) and detector, the 15px headline, the entity line, four evidence metrics in a row with change or note beneath, the suggested action and a one-line "Flagged because …", and a quiet "Inspect" affordance. Rows run 200–217px; eight findings fill one scrolling page.
- **Concept B — Decision Workspace:** a 400px ranked list beside a detail pane, in the Creatives inspector's register: list rows with priority, headline, entity and the one leading number ("£138.83 cost per purchase", "0 purchases on £638"); the selected row on `surface-subtle` with a 2px accent rule. The pane holds the priority and detector, an 18px headline, the entity, four 20px evidence metrics, a 140px daily chart on the Overview's chart geometry with the previous period aligned by day (purchases, spend or CTR as the finding warrants), a share-of-spend bar for the concentration finding, a now / before / change table (or the ads in the campaign for the underfunded winner), the suggested action, and a tinted "Why this was flagged" panel naming the detector. Priority filter and selection are real (client component); the filtered-empty state is a sentence.
- **Concept C — Analytical Briefing:** a one-sentence summary ("3 issues need attention, 3 opportunities and 2 things to watch for Luxe Skin Co. this period."), then findings grouped by decision category: Needs attention full width with three evidence metrics to the right of each finding; Opportunities and Watch side by side beneath with evidence under each finding; a dot in each group heading carries the priority; a closing line states that findings are computed for the period and nothing is applied automatically.
- **Empty state:** the fourth frame shows Concept C with no high-impact findings: "Nothing needs attention, 3 opportunities and 2 things to watch …" and, in the group, "No high-impact findings for this period — Other groups may still hold findings. Findings are recomputed for every period." Concept B's filtered-empty treatment is the same sentence pair.

**Trust and methodology:** priority is carried by order, weight and a 6px dot (red for high impact, blue for opportunity, outlined neutral for watch), never by a coloured box; changes use the shared `Delta` at the 5% materiality threshold; target relationships are text ("£110.83 over", "£6.24 under target"); every concept states where the numbers come from. Suggested actions are sentences, not buttons.

**Render verification (Chrome DevTools, 1440):** four frames at 1440 wide, each with Insights current in the replica navigation and a 1198px main column with no horizontal overflow; A rows 200–217px with four evidence cells; B list of eight with the first selected, the detail showing four evidence cells, a four-tick purchases chart and a five-row comparison; selecting the fourth row switches the detail to the underfunded winner with its four-ad table; the Watch tab filters to two and the concentration finding shows the share bar instead of a chart; C renders three groups (3 / 3 / 2) at 1118px and 535px widths; the empty frame reads as designed. No console errors or exceptions. The comparison tables confirmed every headline figure (for example cost per purchase £32.39 → £51.99 is +60.5%; Retinol ROAS +1.5%; Cart Abandoners purchases 26 → 57).

**Skills:** Impeccable `shape` (three briefed directions with different information structures), `layout` and `typeset` as checklists (hierarchy headline → evidence → action → methodology; 18/16/15/14/13/12px roles), `polish` as one bounded inspection round through the probe (the round renamed the retargeting finding from its "Dynamic" segment, added the creative's impressions to its comparison, replaced a duplicated count line with "Ranked by priority" and made Concept C's group priority visible). `design-premium` as the precision bar; `design-clean` as the restraint check. Detector: zero findings on `src/app/insights-lab`.

**Production untouched:** `/insights` and every other page are unchanged; the working tree holds only the untracked lab. No DESIGN.md or decision change until a concept is selected. Caveat: the fixtures are deterministic for the seeded 7-day Luxe workspace; a production engine must detect these conditions rather than pin them.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (50), `pnpm build --webpack`, `git diff --check`.

**Next checkpoint:** owner reviews http://localhost:3000/insights-lab at 1440px and selects a concept. The lab is not committed or pushed.

---

## 2026-10-03 — Insights production implementation (Concept B workspace, Concept C briefing, deterministic engine)

**Phase:** APP 05 core, production Insights, from the manually selected `/insights-lab` concepts. The Overview, sidebar, Campaigns and Creatives are locked and untouched; Ask Analyst, Clients and Settings unchanged. Nothing committed.

**Lab comparison and selection:** three concepts were rendered inside the approved shell on lab-only fixtures. The owner chose Concept B — Decision Workspace — as the page (ranked queue beside an evidence pane), borrowed Concept C — Analytical Briefing — for the one-sentence orientation and its grouping language only, and rejected Concept A — Priority Analysis Feed — as the page structure. Recorded as D-036; the engine decision as D-037.

**Engine (`src/domain/insights/`, `src/features/insights/facts.ts`):** no insight logic existed (the page was a placeholder), so the smallest proper deterministic layer was built. `collectInsightFacts` reads the repository once for the client and the selected + previous periods and produces source-agnostic facts (account, campaigns with their ads, creatives; snapshots and day-aligned daily series). `runInsightEngine` runs ten pure detectors over the facts, keeps one finding per entity (priority, then detector precedence) and orders by priority, then spend involved. A finding carries id, detector, priority, entity (type, id, name, context), headline, evidence, comparison rows, target relationship, optional chart and breakdown, action, reason, key value and its ordering spend. Lab fixture text was not copied; nothing names a client.

| Detector               | Fires when (against the previous period)                                                                                                    | Priority                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Zero-conversion spend  | no conversions on ≥5% of account spend and at least twice the target cost per conversion                                                    | High impact                                         |
| Campaign deterioration | spend +10% or more while conversions −10% or more; ≥5 previous conversions and some current ones                                            | High impact; Watch when cost is still within target |
| CPA spike              | cost per conversion +25% or more, ≥5 conversions in each period                                                                             | High impact over target; Watch within it            |
| ROAS decline           | ROAS −20% or more, revenue tracked, previous revenue and ≥5 conversions                                                                     | High impact below the ROAS target; Watch otherwise  |
| CTR deterioration      | campaign CTR −15% or more on ≥1,000 impressions in each period                                                                              | Watch                                               |
| Creative fatigue proxy | creative CTR −15% or more, a negative daily CTR trend across both periods, CPM and spend each within ±15%, ≥3-day period                    | Watch                                               |
| Spend concentration    | top three ≥60% of spend across ≥6 delivering campaigns, or one ≥40% across ≥3                                                               | Watch                                               |
| Underfunded winner     | in a campaign with ≥3 delivering ads, the lowest-cost ad with ≥3 conversions, cost ≤75% of the campaign's, ≤20% of its spend, within target | Opportunity                                         |
| Scaling winner         | spend +10% or more, conversions up, cost per conversion up no more than 5%, within target                                                   | Opportunity                                         |
| Campaign improvement   | conversions +25% or more and cost per conversion −15% or more, within target                                                                | Opportunity                                         |

Every assessed entity must carry ≥5% of account spend. Thresholds live in `INSIGHT_RULES` and feed the "why this was flagged" copy, so the explanation always states the rule that ran. Copy is observational ("Spend rose 31.4% while purchases fell 43.5%.", "This creative shows a fatigue pattern: CTR fell 19.4% while CPM held steady.") and actions are advisory sentences.

**Calibration across the three clients and five presets:** the first run also flagged the Autumn Reset creatives as fatigued while their spend rose 36–88%; the fatigue rule now requires spend within ±15% (the seed's pattern is erosion on stable CPM and spend). Deterioration no longer fires when conversions reach zero (that is zero-conversion spend). Whole-number targets read "£28". Luxe 7-day yields the eight findings the lab showed, now computed: Autumn Reset deterioration, Vitamin C Brightening CPA spike, Overnight Repair zero-conversion spend, Retinol scaling, Cart Abandoners improvement, the Collagen Night Mask underfunded ad, spend concentration and the Vitamin C UGC fatigue proxy. Peak Fitness and Arc Cloud produce their own findings in leads and trials (for example Arc 14-day: G2 Leader CPA +45.0% to $155.39, $70.39 over the $85 target). Peak Fitness and Arc Cloud "today" produce none, which exercises the empty state.

**Known limits, recorded rather than hidden:** the seed's daily noise makes 7-day windows differ by anchor date (the Vitamin C creative's 7-day CTR drop ranges from 6% to 23% across a week), so the 7-day CPA spike and fatigue findings appear on some days and not others; the 14-day view finds every documented pattern on every anchor tested. A campaign that is persistently far over target without changing (Overnight Repair in the 30-day view: five purchases on £2,653) is not flagged, because no target-gap detector is in this phase's scope.

**Visual translation (`src/app/insights/page.tsx`, `insights-workspace.tsx`, `finding-detail.tsx`, `finding-chart.tsx`, `priority.tsx`, `insights-model.ts`; placeholder `insight-sections.tsx` removed):** header in the product language ("Luxe Skin Co. · 8 findings across 9 campaigns and 26 creatives", period block, preset control); the briefing sentence at 16px 500; underline priority filters with counts; a 380/400px list grouped as Needs attention / Opportunities / Watch with a dot, detector, headline, entity and one key value per row; a sticky detail pane with priority and detector, 18px headline, entity line, three or four evidence metrics with change or target notes, a 140px chart only where a trend is the evidence, the ads or campaign-share breakdown where the claim is relative, now / before / change, the suggested action and "Why this was flagged". Below 1280px rows open the Creatives inspector's sheet pattern with an "All findings" back control. No execution buttons, no scores, no alert boxes.

**Tests (53 new, 103 in total):** `src/domain/insights/rules.test.ts` (37) covers each detector firing and not firing at its thresholds on synthetic facts, priorities, evidence values, target relationships and notes, the fatigue wording and its one-day-spike and short-period guards, the concentration arithmetic, dedupe and ordering, zero denominators, an account without spend, target helpers, the trend slope, formatting and the briefing sentence. `src/features/insights/insights.test.ts` (16) runs the engine on the seed: the exact Luxe 7-day set, the documented patterns in the 14-day view across a week of anchors, evidence recomputed independently from the repository, the underfunded ad against its campaign, concentration over delivering campaigns, at least three finite evidence values per finding across 3 clients × 5 presets, no causal or execution language, per-client vocabulary, currency and ROAS rules, client isolation, period isolation (rows outside the two periods distorted tenfold leave findings unchanged), determinism and a client without metrics.

**Render verification (Chrome DevTools, real route, no screenshots):** 1440: list 400px, detail 665px, eight rows in three groups, the first finding selected with four evidence cells, a four-tick chart, a four-row comparison, action and reason; every finding opened in turn with no overflow. 1280: list 380px, detail 533px, no overflow (the first pass put the 400px rule before `xl` because the units differed; the grid now uses px breakpoints). 1024: list full width, 480px sheet. 390 and 360: layout viewport equals the device width, tabs fit (right edge 334px), rows open a full-width sheet with focus on "All findings"; Escape and the back control close it and return focus to the row; every finding's sheet has no overflow. Filters: counts truthful; selection preserved when it survives a filter (Retinol stays selected under Opportunities) and moved to the first finding otherwise; Arc 14-day Watch shows "Nothing to watch for this period. 3 findings are listed under All." Keyboard: Tab reaches each row, Enter and Space select, the 2px accent focus ring shows, filters expose `aria-pressed`, rows expose `aria-pressed` on desktop and `aria-haspopup="dialog"` below 1280px. Reduced motion: the detail's animation resolves to none. Switching the preset to 7D and the client to Luxe Skin Co. through the real controls recomputes the briefing, counts and selection. No console errors or exceptions.

**Functional matrix (curl):** three clients × five presets (7d, 14d, 30d, today, yesterday): all 200; briefing and tab counts agree; no campaign or creative names from another client; currency correct (£ for Luxe Skin Co. and Peak Fitness, $ for Arc Cloud).

**Skills:** Impeccable `layout`, `typeset` and `polish` as checklists with bounded inspection rounds through the probe (rounds fixed the 1400px grid ordering, the 1280 gutter, count-axis tick rounding and the redundant account context). `design-premium` as the precision bar, `design-clean` as the restraint check. Detector: zero findings on the Insights files.

**Docs:** DESIGN.md §24, D-036, D-037, this entry. `/insights-lab` is kept, unlinked, until the production page passes manual review.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (103), `pnpm build --webpack`, `git diff --check`.

**Next checkpoint:** owner's manual visual review of `/insights` at 1440, 1280, 390 and 360 for the three clients and the presets. No commit or push.

---

## 2026-10-03 — Insights approved for lock

**Human approval:** the owner has reviewed and approved production Insights. The implementation above is now the approved baseline; no visual changes were made during the lock checkpoint.

**Verification:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (103 tests in 7 files), `pnpm build --webpack` and `git diff --check` all passed. The deterministic engine, production UI, detector and seeded-scenario tests, design lab, DESIGN.md §24 and D-036/D-037 are included. Overview, sidebar, Campaigns and Creatives have no diff against the locked baseline. The changed-file audit found no secrets, environment files, screenshots or caches. All production and existing lab routes returned 200 in Chrome without uncaught page errors.

**Documentation discrepancy:** PRODUCT.md's older capability summary still describes some now-implemented surfaces as unbuilt. The newer design and engineering records describe the current implementation. It is flagged here without expanding this checkpoint's edits.

**Checkpoint:** commit and normal push of the approved Insights state are authorized. Ask Analyst exploration begins only after the push succeeds; production `/ask` and all approved surfaces remain untouched.

---

## 2026-10-03 — Ask Analyst interaction study

After the approved Insights checkpoint (`e52e42e`, pushed to `origin/feat/foundation`), added `/ask-lab`: exactly three 1440px concepts inside the approved lab shell. **A — Analyst Chat** keeps full open analytical answers in a scrolling thread with a bottom composer. **B — Analytical Query Workspace** puts the composer above the active answer, with evidence/entities alongside and recent questions below. **C — Hybrid Analyst Thread** quietens earlier turns and keeps the active answer, follow-ups and composer available. The frontend craft guidance informed this structural comparison; existing typography, semantic colours and motion tokens are reused.

Chat-style interaction is approved; no layout is selected. Four local response fixtures use actual Luxe Skin Co. seven-day metrics and deterministic Insights ordering. The CPA answer corrects the near-flat account premise; the campaign-to-creatives follow-up aggregates only that campaign's ads. Causal uncertainty is explicit, and unsupported questions disclose the fixture boundary. No external AI, API or pretend analysis service. Preview controls expose first-use, pending, error and insufficient-evidence states; keyboard submission, cancellation, retry and lightweight history work locally. Twelve fixture tests cover evidence, context, denominator handling, cross-campaign creative reuse and unsupported questions.

Only lab files and this note are changed. Production `/ask`, all locked surfaces, DESIGN.md and permanent decisions are untouched. No commit or push. Manual selection is next at http://localhost:3000/ask-lab; production implementation and mobile adaptation are deferred.

### Human review — A/C conversational refinement

Concept B was rejected and is no longer rendered in the comparison. C is the stronger candidate, not an approved production selection. Adapted the supplied Beautiful UI component's soft bordered field, compact square dark send control, upward arrow and right-aligned user turn into A and C using existing tokens. A keeps its full thread; C keeps the dominant active answer and collapsed history. Analytical answers remain open on the white canvas. No demo tabs, header actions, fixed chat card, blur, elapsed-time labels or scripted phase sequence were copied.

Both candidates now start empty. The composer grows from one to two lines, preserves Enter / Shift+Enter and IME behaviour, and returns focus after submission or follow-up. Removed timed fixture replies: answers resolve locally; pending/error exist only as explicit review states. Chrome at 1440px verified empty/focused/disabled controls, submission, user-turn and answer reveal, follow-ups, pending/cancel, error/retry, insufficient evidence and reset for A/C, with no page errors. Rise-in uses the existing 220ms token and resolves to no animation under reduced motion. Production and design-system files remain untouched; no commit or push. Final selection between A and C is pending.

## 2026-10-03 — Production Ask Analyst translation (manual review pending)

The owner selected **Concept C — Hybrid Analyst Thread** with the refined Beautiful UI-inspired composer and user turn. A was not selected; B was rejected. Translated the approved structure into `/ask`; `/ask-lab` is preserved. The frontend craft guidance was used to preserve the approved hierarchy and verify actual desktop/mobile states, not to reopen the direction. No locked production surface or shared visual token was changed.

**Implementation:** isolated phrase-intent interpretation → existing Insights facts/detectors → structured answer → open analytical presentation. Supported families include CPA/ROAS/CTR/spend movement, deterioration/improvement, zero-conversion spend, campaign/creative investigation and efficiency ranking, concentration, campaign creatives, fatigue evidence and period comparison. Rankings state their basis; missing ratios remain null. A pure helper re-aggregates campaign-linked ads for creative follow-ups, excluding reuse elsewhere. No LLM, external request, new runtime dependency or duplicated detector thresholds.

**Context and trust:** selected campaign/creative and previous analytical entity are bounded to the server-selected client and both periods. Unsupported questions, unknown names and mismatched requested dates get honest limitations. Start fresh clears thread/context; actual client/date changes remount the workspace and abort pending response delivery. History selection restores its own context. A same-origin read-only endpoint validates payload size, question length, scope and entity membership. No authentication or persistent conversation system is introduced into the seeded demo.

**Interaction:** first use hides the history control; it appears only after a previous answer exists. Real pending/error/retry/cancel states, duplicate-send protection, one/two-line composer, Enter/Shift+Enter and IME handling. User turn and coherent answer use standard rise-in; follow-ups use the standard fade token with a 220ms CSS delay. Reduced motion removes both. No synthetic latency or staged answers.

**Verification:** Chrome exercised first use, the CPA → campaign → creatives → fatigue thread, unsupported input, reset, history selection, keyboard input, injected network failure/retry, held-request cancellation and preservation of a newly typed draft. Real client controls switched Luxe Skin Co. / Peak Fitness / Arc Cloud; date changes cleared the old thread, vocabulary/currency updated, and Today omitted the chart. At 1440/1280/390/360 there was no page-width overflow; wide tables remained local and the composer stayed inside the viewport. Normal motion reported rise-in and a 0.22s follow-up delay; reduced motion reported none. No uncaught page errors. Screenshots are outside the repository.

**Tests/docs:** added parser, seeded answer, context/isolation, reducer, server-rendered UI and endpoint contract tests using the existing test runtime. DESIGN.md §25, D-038/D-039 and only the stale capability lines in PRODUCT.md were updated. Final check results will be recorded below. Production manual human visual review is required before commit; no commit or push performed.

**Composer focus refinement (owner review):** the owner disliked the bright-blue ring around the composer. Its source was the form's `focus-within` accent border plus a 2px accent outline at a 2px offset. Focus is now neutral: the field turns white and its 1px border darkens from `border` to `ink-muted` (about 5:1 against white), with no outline, ring or glow. The textarea's `outline-none` became `outline-hidden`, so forced-colours mode still shows a system focus ring. The send button, its global focus ring, spacing, typography and motion are unchanged. DESIGN.md §25 is updated. No commit or push.

---

## 2026-10-03 — Real data onboarding: Meta Ads CSV import (manual review pending)

**Starting point:** `4375c1e` "Polish and lock Ad Analyst Ask Analyst"; branch clean and in sync. Overview, sidebar, Campaigns, Creatives, Insights and Ask Analyst are locked. Nothing in this pass is committed.

**What existed:** one read path (`AdAnalystRepository`, in-memory) over a seeded `Dataset` (agency → client → ad account → campaign → ad set → ad → creative, ad-level additive `DailyMetrics`, ratios derived in `domain/metrics.ts`), cookie-selected client and preset in `getWorkspace()`, read-only Clients and Settings, no persistence and no database (D-006).

**Architecture (D-040):** source adapter → validation → normalisation → import store → composed dataset → unchanged repository → existing pages. `src/data/import/` holds the CSV reader, canonical import fields with an untrusted-mapping sanitiser, the Meta vocabulary (header aliases, currency suffixes, outcome and value candidates, breakdowns, delivery, objective and format values), validation, normalisation with deterministic client-namespaced IDs, the merge policy and the preview summary. `src/data/store.ts` is the persistence boundary; `src/data/compose.ts` appends imported clients to the seed; `src/features/import/service.ts` is the only writer, behind `POST /api/import` (same-origin, streamed 16 MB request limit). The UI is `src/features/import/` at `/clients/import`.

**Stages:** Upload (`.csv` only, 10 MB, decoded as UTF-8 or UTF-16 with BOM, binary refused, header must contain recognisable reporting columns) → Inspect (recognised columns, outcome and value candidates, currency, columns not imported and why) → Map (destination client: existing imported client or new client with name, business type, currency, timezone and optional targets; field-to-column table with required, identity-pair and optional fields) → Validate (errors block, warnings allow, counts and five sample lines each) → Preview (destination, account, dates, structure counts, rows and ad-days, spend, conversions, value, replace policy) → Import (server re-runs everything) → Complete (summary, View Overview, Import another file).

**Validation decisions:** required mappings (date, spend, impressions, clicks, primary conversion, and an ID or name for campaign, ad set and ad); ISO dates only and real calendar days; one day per row (Reporting ends must equal the date); plain or thousands-grouped numbers only, no symbols or exponents; negatives refused; fractional impressions or clicks refused; blank metrics read as 0 with a warning; IDs rounded by spreadsheets (1.2E+17) refused; names cleaned of control and bidi-override characters and capped; formula-like names warned and stored as text; one account per file and it must match the client's account; one currency (D-043); "Results" checked against "Result indicator"; duplicates per D-041; missing IDs, missing delivery status and missing creative columns disclosed as warnings.

**Product model changes (shared, behaviour-preserving for demo data):** `Client.targetCpa` is nullable and `Client.revenueTracked` optional (D-042); `CreativeType` gains `unknown` and thumbnails gain `unavailable` (D-045); `Campaign.objective` is nullable; `Dataset`/repository/`Workspace` carry source records; periods end on the last day with data when that is before today (D-046). Locked pages received only the null handling these require (Overview lead metric and notes, Campaigns target line and objective, Creatives target line and the unknown-format cell, Insights target clauses, an empty account ID omitted on the Overview) and the sidebar tile label; seeded clients render identically. The committed reference labs received narrow type fixes only, plus one structural fix: the Insights lab's priority labels moved to `src/app/insights-lab/priority.ts`, because a client component imported them from the fixtures module, which reaches the data layer and now the server-only file store; the webpack build failed until it was split.

**Clients and Settings:** Clients gained "Import Meta CSV" and "New client", a Source column and "Not set" targets; its table scroller now uses paint containment because Chrome's phone emulation laid the page out at 881px before this pass (980px with the new column) and at device width after. Settings shows the data source, an Imports card and a targets form for imported clients only.

**Persistence (D-044):** local JSON file (`.data/imports.json`, git-ignored, atomic writes) behind `ImportStore`; tests use the memory store. **Decision required:** a database and auth scoping before any hosted or multi-user deployment.

**Tests (48 new, 236 total):** `src/data/import/import.test.ts` (31): quoted commas, escaped quotes and newlines with line numbers, CRLF/LF/CR, BOM, blank cells, delimiters, limits, binary, encodings; number and date parsing; currency suffixes ("Clicks (all)" is not a currency); Meta detection and classification; mapping proposals per business type, alternative labels, untrusted mapping keys including `__proto__`; validation of normal ecommerce and lead-gen exports, revenue rules, malformed numbers with counts and samples, negatives, fractions, bad dates, multi-day rows, missing identity, rounded IDs, missing mappings, mixed and mismatched currencies, account consistency, mixed Results, exact and conflicting duplicates and breakdown summing, zero impressions and clicks (ratios stay undefined), name cleaning; normalisation (hierarchy, deterministic IDs, statuses, creatives, totals) and the replace policy (repeat import idempotent, overlapping export 35 new and 35 replaced). `src/features/import/service.test.ts` (17): new-client import and source record, repeated import, refusals (demo client, unknown client, duplicate name, ROAS target without value, currency mismatch, missing value for a value-tracking client), request re-validation, target editing, period anchor, Overview totals, Campaigns rows, Creatives metrics and the unknown-format breakdown, an Insights zero-conversion finding, Ask facts and the waste answer, no target language without targets, client isolation between demo and imported clients and between imported clients, file-store round trip and refusal to overwrite unreadable data. All expected values are recomputed from the fixture generator, not read from fixture text. Synthetic samples for manual review: `docs/samples/meta-ads-ecommerce-sample.csv` and `docs/samples/meta-ads-leads-sample.csv` (invented accounts and numbers).

**Verification (Chrome DevTools, real routes, no screenshots):** a `.txt` file and a header-less CSV get specific upload errors; the malformed file is blocked with "6 rows contain invalid Amount spent (GBP) values." and five sample lines; a missing client name and an unmapped Spend take focus with inline messages; the ecommerce sample imports as a new client (17–30 Sep, 3 campaigns, 5 ads, £2,387, 70 ad-days) and View Overview opens it anchored to 24–30 Sep with "Meta Ads · CSV import" in the sidebar; Overview, Campaigns, Creatives ("Format unknown" 100% of spend), Insights (zero-conversion spend on the Night Cream campaign, concentration watch), Clients and Settings render it; re-importing the same file reports 0 new and 70 replaced; the lead-gen sample creates a second client with Leads and no value; Ask Analyst answers "Where am I wasting spend?" for it; saving a £7.50 target in Settings updates the Overview; switching back to Luxe Skin Co. restores the demo data and label. Layout at 1440, 1280, 390 and 360: import stages, Clients, Settings and the analytics pages lay out at device width with tables scrolling locally (Campaigns keeps its known 588px phone layout, unchanged). Keyboard: Tab reaches the file input ("Choose file", accent focus ring), every control is labelled, focus moves to each stage heading, the Importing state is announced and `aria-busy`. No console errors. Fixes from verification: "Clicks (all)" was read as the currency ALL, February 30 was accepted, focus dropped to the body while importing, a doubled word in blank-value warnings, an ISO date in prose, a dangling separator when the account ID is absent, and the Clients phone layout.

**Known limitations:** no deletion or undo of imported data; persistence is local only (D-044); one ad account and one currency per file; ISO dates and full-stop decimals only; reach and frequency are not stored; no artwork or copy for imported creatives; status is inferred when the export has no delivery columns; presets name trailing windows, so an older export shows its own dates under "7D" and "Today". Real Ads Manager exports should be tried against the header vocabulary before release: labels vary by locale and attribution settings.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (236), `pnpm build --webpack`, `git diff --check`.

**Next checkpoint:** owner's manual review of `/clients/import`, `/clients`, `/settings` and the analytics pages with an imported client. No commit or push.

---

## 2026-10-03 — Import UX simplified after manual review; "invalid Day values" fixed (manual review pending)

**Manual review finding:** the Meta CSV importer worked but felt engineer-facing. Seven visible steps mirrored the pipeline; the Map step listed every canonical field, most already auto-detected, plus optional internal fields (delivery, objective, result indicator, creative and account columns) shown as rows of "Not mapped"; validation wording made the person feel responsible for technical import details. A genuine bug was reported: valid ISO dates such as 2026-09-17 appeared as "invalid Day values".

**Date bug, root cause:** the date parser was correct. Reproduced in Chrome with the lead sample: under the default Ecommerce business type the Primary conversion was left unmapped, its dropdown offered every column with Day first, and choosing it pointed a number field at the Day column. The validator then reported each row's failed number using the column's header, "28 rows contain invalid Day values", with the dates as samples, so it read as bad dates. Timezone overrides (London, Los Angeles, Kiritimati) made no difference. **Fix:** a column-kind check reports a number field pointed at dates or text as one setup error naming the field ("Primary conversion is set to “Day”, which holds dates, not numbers."), with no per-row flood; dropdowns offer only columns that can hold the field (numbers for metrics, never IDs, ratios or dates); the business type is suggested from the outcome columns, so a Leads file starts as Local lead generation with Leads mapped; and the date parser now also accepts a trailing time without converting it.

**UX simplification (D-047):** four visible steps, Upload → Review setup → Review import → Import, over the unchanged pipeline. A readable upload moves straight to Review setup, which shows what was detected (file, dates, rows, campaigns, currency, conversion and value columns) and asks only for the client, the primary conversion when ambiguous, conversion value, optional targets, timezone, and currency only when the file does not state one. "Advanced column mapping" is a collapsed native disclosure with a status line; it shows required and mapped fields, reveals the rest on request, and opens itself only when a required column is missing. Column and setting problems stay in setup with focus on the control; file problems appear in Review import as genuine blockers with sample lines. Review import shows the facts, "What we'll do" and "Handled automatically"; completion reads "Imported successfully" with View Overview and Import another file. Generic "Results" is no longer chosen silently.

**Validation changes:** resolved safely and disclosed: blank results (read as 0), amounts carrying the import's own currency symbol, exact repeated rows, breakdown rows, total rows without a date or campaign (skipped), a time part on dates (ignored), missing IDs, delivery status, creative and value columns. Still blocking: unreadable or decimal-comma numbers, negative values, fractional counts, unreadable or impossible dates, multi-day rows, rows without an ad, spreadsheet-rounded IDs, more than one currency or account, a currency or account that differs from the client, Results counting several events, rows that disagree. Messages are field-first and calm ("We couldn't read the date on 1 row.", "This file contains more than one currency (USD and GBP), so it can't be imported as one account."). The "currency assumed" note now appears only when the file states no currency at all.

**Tests (21 new, 257 total):** ISO dates (2026-09-17 and 2026-09-18 accepted, every day of a 14-day export accepted, unchanged under five TZ settings including a time part, invalid and non-ISO forms rejected, the reported scenario now a single field error with no "invalid Day values"), a date field on a text column, currency symbols (matching accepted, different blocked), total-row skipping, warning-only imports proceeding, genuine blockers remaining; and `src/features/import/setup.test.ts` (10): a normal export needs only a client name, a lead export suggests lead generation and maps Leads, an existing client's type is kept, a Results-only file forces a choice, mixed purchases and leads suggest nothing, missing optional columns don't block, a missing required column shows in the advanced status, advanced mapping covers every other field and offers only fitting columns while keeping the current choice. Five earlier expectations were updated to the new wording and to Results not being preselected.

**Verification (Chrome DevTools, no screenshots):** normal ecommerce export (name only, then import, 70 rows), lead export (business type and Leads detected, Day not offered), Results-only file (focus moves to the conversion dropdown with its error linked), no creative metadata and no value column (calm notes), mixed currency (single blocker, no contradictory currency note, no currency picker), malformed amounts (blocker with five sample lines and a count), valid ISO dates throughout, an impossible date (one-row blocker), advanced mapping opened from the keyboard (18 rows, "Show 4 more", focus on the first revealed field), re-import into an existing client ("0 new · 28 updated"). Layout at 1440, 1280, 390 and 360 stays at device width; advanced mapping scrolls inside itself on phones. No console errors. The verification clients were written to the local, git-ignored store and removed afterwards.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (257), `pnpm build --webpack`, `git diff --check`.

**Next checkpoint:** owner's manual review of `/clients/import`. No commit or push.

---

## 2026-10-03 — CSV onboarding approved and committed

**Checkpoint:** the Meta Ads CSV import and client onboarding milestone (D-040 to D-047) passed manual review with the four-step flow and is committed and pushed to `origin/feat/foundation` in this checkpoint. Final checks: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (257), `pnpm build --webpack`, `git diff --check`. The local import store held one review client ("newnametest", from the synthetic sample); it was removed, and `.data/` is git-ignored. PRODUCT.md now states the four-step flow, the approval and the real-export follow-up.

**Still open:** hosted, multi-user persistence (D-044; the JSON file store is local development persistence only) and validation against real Ads Manager exports, whose labels vary by locale and settings.

---

## 2026-10-03 — Hosted persistence, authentication and workspace isolation (manual review pending)

**Starting point:** `da45316` "Merge completed Ad Analyst foundation" on `main`; this work is on `feat/persistence`. Imported data lived in a local JSON file (D-044) with no sign-in and no tenant scoping (D-006); client selection was a cookie preference. Nothing in this pass is committed.

**Architecture (D-048):** UI → `loadSession()` (the data access layer, `src/features/workspace/server.ts`) → `WorkspaceGateway` (`src/data/supabase/gateway.ts`, Postgres functions only) → Supabase Postgres with RLS. Reads: one `workspace_snapshot` call per request returns the active workspace's clients, accounts, imports and coverage plus the selected client's hierarchy and last 120 days of metrics; `snapshotRepository()` maps it into the existing `Dataset`, so `AdAnalystRepository`, every locked page, Insights and Ask are unchanged. Writes: `import_meta_csv` and `update_client_targets`. The pure selection logic (`chooseActive`, `buildContext`, `defaultWorkspaceName`) moved to `src/features/workspace/context.ts` so it is testable without Next. `src/data/store.ts` and `src/data/compose.ts` are deleted; `getDemoRepository()` is the only seed entry point.

**Schema (`supabase/migrations/20261003170000_workspaces_and_imported_data.sql`):** `workspaces`, `workspace_members` (PK workspace + user, role owner/member), `clients` (name 1–80 characters and unique per workspace case-insensitively, business type, GBP/USD/EUR, timezone, nullable positive targets, `revenue_tracked`, primary conversion column, a ROAS target requires revenue), `ad_accounts` (one Meta account per client, external ID kept), `campaigns`, `ad_sets`, `creatives`, `ads` (UUID keys, `external_id`, `source_key` unique per client, composite foreign keys `(workspace_id, client_id, parent_id)` so no row can reference another tenant's parent), `daily_metrics` (PK ad + date, non-negative numeric spend/revenue/conversions and integer impressions/clicks), `imports` (file name and bytes, rows, dates, account, currency, outcome and value columns, new and updated ad-days, importing user and time). Indexes on membership by user, every parent key, metrics by client and date, imports by client and time.

**Auth (D-049):** emailed one-time links via `signInWithOtp` (PKCE) from a server action; `/auth/callback` exchanges the code or verifies a `token_hash`; sessions live in HTTP-only cookies managed by `@supabase/ssr`. `src/proxy.ts` refreshes the session on every request, verifies it with `getClaims()`, redirects signed-out pages to `/sign-in`, returns 401 JSON for signed-out API calls, and marks those responses `private, no-store`. `loadSession()` verifies claims again. Sign-in answers identically for unknown addresses; `AD_ANALYST_ALLOW_SIGNUPS=false` disables account creation. Sign-out clears the session and the selection cookies. Supabase errors never reach the page.

**Workspaces and RLS (D-050, D-051):** first sign-in calls `ensure_default_workspace` (security definer, advisory-locked per user, idempotent) which creates "<Name>'s workspace" with the user as owner. One active workspace; `aa_workspace` may choose among memberships. RLS on all ten tables with `is_workspace_member(workspace_id)` as the root rule; imports are select and insert only; `anon` has no privileges; the read and write functions are security invoker and check membership themselves. No service-role key exists in the app. A forged or stale client cookie resolves inside the workspace (to its first client), and the import route and settings action only accept clients in the loaded workspace before the database checks again.

**Import persistence (D-053):** the route re-parses and re-validates as before, `planImport()` builds a key-based payload (`buildImportPayload`, `src/data/import/payload.ts`), and `import_meta_csv` writes everything in one transaction: client create-or-find, account upsert with mismatch refusal, entity upserts on `(client_id, source_key)`, a check that every metric row resolves to an ad of this client, metric upserts on `(ad_id, date)`, then the import record. Failures map to fixed messages (`importFailure`): an unknown and a foreign client both read "That client isn't available. Choose another client.".

**Demo strategy (D-052):** demo mode (`pnpm dev` without Supabase variables, or `AD_ANALYST_DEMO_MODE=true`) serves the seed with no sign-in and no writes; imports answer "Imports need a connected database". Nothing seeded is ever stored. A production build without configuration shows "Not connected yet". Session loading reads cookies before checking the mode so every app route renders per request even when built before the variables existed (the first build prerendered pages as static redirects).

**UI (minimal, no shell redesign):** `/sign-in` (one email field, "Check your email" state, link-expired and unavailable messages), an app error boundary ("This page couldn't load"), an Account card with Sign out in Settings, "Workspace" instead of "Agency" in Settings when signed in, "No clients yet" in the sidebar for an empty workspace, and Settings rendering without a client so a new user can still sign out. DESIGN.md §27 records the rules. The import flow itself is unchanged.

**Tests (24 new, 276 total):** Postgres-level tests run the real migration in PGlite (Postgres 18 in WebAssembly, dev dependency) with a small Supabase shim (`anon`/`authenticated` roles, `auth.users`, `auth.uid()` from JWT claims), switching to the `authenticated` role per user so RLS is exercised. `src/data/supabase/schema.test.ts` (11): default workspace idempotent and refused anonymously; membership grants and revokes access across every table; users cannot add themselves to a workspace; `anon` is denied on every table and function; cross-workspace inserts fail and updates and deletes touch 0 rows; composite keys stop cross-tenant parents; imports are append-only; imports into a foreign workspace are refused; a failing import (unknown ad key, negative spend) leaves every count unchanged; re-imports upsert without duplicates; a different ad account is refused; the snapshot refuses foreign workspaces and resolves a forged client to the caller's own. `src/features/import/service.test.ts` (rewritten, 12): import end to end through SQL, repeated import 0 new / 70 updated, overlapping export 35 / 35 with kept, updated and added days, foreign and missing clients answered identically with nothing stored, names per workspace including a stale-planner race caught by the unique index, ROAS, currency and revenue rules, request re-validation, targets scoped to the workspace, and the stored data flowing through Overview, Campaigns, Creatives, Insights and Ask. `src/features/auth/auth.test.ts` (9): deployment modes, route access decisions, email validation, non-enumerating messages. `src/features/workspace/context.test.ts` (4): cookie selection only among accessible items, foreign client fallback, empty workspace, workspace naming. Five file-store tests were removed with the store.

**Verification:** production build without variables: `/`, `/campaigns`, `/settings` redirect to `/sign-in`, which shows "Not connected yet"; `POST /api/import` and `/api/ask` return 401; a bad callback goes to `/sign-in?error=link`. Dev server in demo mode: every page returns 200 with demo data, `/sign-in` redirects home, `/clients/import` shows the read-only message and `POST /api/import` returns 503 with it. The client bundle contains no PGlite and no Supabase variable names. **Not verified:** a live Supabase project (no credentials are configured on this machine), so magic-link delivery, the callback exchange, cookie refresh through the proxy and the RPCs over PostgREST have not run against real Supabase.

**Housekeeping:** iCloud Drive had created byte-identical " 2" copies of files and, later, 22 empty " 2" directories inside the repo; all were moved to the Trash, nothing tracked was affected.

**Known limitations:** live integration unverified; no workspace switching, invitations or member management UI; no deletion of imports or clients; one round trip per request loads a 120-day window; sign-in links must open in the requesting browser; production email needs custom SMTP.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (276), `pnpm build --webpack`, `git diff --check`.

**Next checkpoint:** owner configures a Supabase project and reviews sign-in, first workspace, import, re-import, targets and isolation with two accounts. No commit or push.

---

## 2026-10-03 — Landing-page exploration (manual selection pending)

Started `/landing-lab` with three complete, vertically stacked homepage concepts: **A — Product-Led Precision** (product-first screen showcase), **B — Agency Operations Story** (account review through client conversation), and **C — Analytical Editorial** (a spend finding followed by evidence exhibits). Explores product-led, agency-led and outcome/analyst-led positioning using the existing white, cool-grey, ink and blue system. Copy describes CSV-based analysis, not live Meta monitoring, invented causes or automatic budget changes. Demo CTAs open the existing demo only when demo mode is active; otherwise they lead to the product proof.

Six actual product screenshots cover Overview, Insights, a zero-conversion finding, Ask Analyst, Creatives and Campaigns. All use Luxe Skin Co. seeded demo data for 27 Sep–3 Oct 2026, are labelled as such, and carry embedded capture provenance. Keyboard-operable product tabs and a question/evidence switcher make the exploration interactive. Desktop review at 1440 and 1280, plus a structural check at 390, found no page-width overflow or broken anchors; demo navigation works and no browser errors occurred. Motion uses existing tokens and respects reduced motion.

Only lab-specific source/assets and this appended note belong to this task. The approved production surfaces, root route and existing persistence/auth work are untouched. DESIGN.md and DECISIONS.md are not changed by this exploration. No merge, commit or push. **Manual human selection is required before production implementation.**

**Checks:** `pnpm format:check`, `pnpm lint` (one spread-prop alt-text warning corrected; targeted lint clean), `pnpm typecheck`, `pnpm test` (276), `pnpm build --webpack`, `git diff --check`. The Impeccable target scan reported no findings; screenshot provenance scan: six rasters, none missing.

---

## 2026-10-03 — Landing-page exploration, round 2 (manual selection pending)

**Round 1 rejected.** Concepts A, B and C did not reach the premium bar the owner set with two new references (an "Answer AIQ" and a "Flowstack" landing page; the images were not available to this session, so the brief's written principles were used). Diagnosis: the marketing pages spoke in the product's own voice (Inter at 48–76px, the app's grey canvas, blue buttons), followed the SaaS skeleton (split hero, tabbed full-screen screenshots, alternating copy and screenshot rows, three numbered steps, a checklist), and showed whole screens rather than the part that proves a claim. Round-1 sources were removed from `src/app/landing-lab/` (an archive was kept outside the repo for this session); its screenshots in `public/landing-lab/` are no longer referenced.

**Three new directions at `/landing-lab`**, each a complete six-to-seven-section page with its own type, palette and one memorable device:

- **1 — Editorial Intelligence:** Literata (display, optical size 72) with Schibsted Grotesk, warm white paper, ink, fine rules, one cobalt signal. Product evidence appears as numbered figures with captions and sources, the hero finding carries numbered callouts, "£638 spent. / 0 purchases." is set as an editorial statement, and an engraving-like plate draws a week of spend as hatched bands per campaign, followed to purchases and the £28 target. Ledger detail is shown as two crops joined by a break mark.
- **2 — Modern Product Monument:** Host Grotesk only, white, a three-line 105px headline, and one visual field: the live Overview standing on a heat field of 9 campaigns × 60 days of spend (each row against its own high), blurred into a cobalt-slate field and resolving into cells at the base. Sparse sections follow (Insights list, Ask, principle, close).
- **3 — Data Editorial System:** Archivo across widths (condensed light for monumental figures, normal for prose). "31.4% more spend / 43.5% fewer purchases" over an indexed "scissors" chart (seven-day rolling spend and purchases for Autumn Reset Sale, both = 100 in the first week, one axis), a £638 → 0 ledger with a 14-day strip, a dark field of nine small multiples labelled with the findings Ad Analyst raised, product fragments, and a measured-versus-not-inferred table.

**Real product, real data.** Exhibits are the shipped components (FindingDetail, AnswerView, InsightsWorkspace, OverviewAnalytics, CampaignsTable) rendered with the seeded Luxe Skin Co. workspace pinned to 3 Oct 2026, inside an inert `Specimen` frame that crops at fixed coordinates and scales to its slot, so text stays crisp. Crops were set from measured element positions; the Campaigns crop pins two viewport-dependent rules (name width, group padding) to their ≥1400px values so the same cells show at 1280. All coded art (`art.tsx`) is computed from the same seed; no numbers are typed by hand except copy that restates them. Motion is one authored moment per concept (plates unveil; the product rises into its field; the scissor lines draw), armed after mount, off under reduced motion.

**Verification (headless Chrome DOM geometry, no screenshots):** at 1440×900 and 1280×800 no horizontal overflow, headline lines fit their columns, the primary action and a product exhibit sit above the fold in Concepts 1 and 2 (Concept 3 leads with its figures; the chart begins at the fold), no SVG label leaves its drawing, no crop slices visible text, all eight reveals fire on scroll, all four faces load, no console errors. Text contrast ≥ 4.95:1 for body copy, 3.41:1 for the large muted statement, ≥ 3.1:1 for chart lines. Mobile was not polished (stacking only), per the brief.

DESIGN.md and DECISIONS.md are unchanged until a direction is selected. No commit or push.

---

## 2026-10-03 — Landing page: Concept 1 selected, refinement pass 1 (manual approval pending)

**Selection:** the owner chose **Concept 1 — Editorial Intelligence**. Its identity is locked: warm paper, Literata with Schibsted Grotesk, the 12-column grid, fine rules, numbered figures with sources, restrained cobalt, the hatched spend-flow engraving and the motion. Concepts 2 and 3 are retired from review (`/landing-lab` now renders Concept 1 only); their source stays in the folder for reference until production translation.

**Focus: product exhibits.** Each exhibit is still the shipped component with seeded data, now cropped to one claim and set on a flat white plate with fixed internal padding, a hairline edge and no shadow. Scales sit between 1.10 and 1.24 at 1440 (0.97–1.10 at 1280), so product text never drops below about 12.6px.

- **Fig. 1 (hero, Insights):** label, headline, campaign and the four figures only, cropped edge to edge of the content; markers 1 and 2 on "+31.4%" and "£110.83 over".
- **Fig. 2 (£638 / 0 purchases):** the finding's headline and its three figures (the comparison table, suggested action and rule box are cropped out; the copy carries them). A measured cobalt leader runs from "0 purchases." on the page to the "0" inside the plate, routed through the gap between columns so it crosses no text, and appears only after its plate has revealed.
- **Fig. 3 (Overview):** the lead measure alone: return on ad spend 2.71x, +3.4% from 2.62x, and 0.79x short of the 3.50x target. The supporting tiles, sparklines and period control are no longer in view.
- **Fig. 4 (Campaigns):** names and cost per purchase joined by the hatched break, now four rows with a fifth fading out to show the ledger continues, larger, with one marker on the distance from target.
- **Fig. 6 (Ask Analyst):** the answer only (correction, summary, cost per purchase, spend, purchases). The question is set on the page as a quotation instead of a chat bubble; one marker on "+0.2% from £26.84".

**Structure:** hero + Fig. 1 → a borrowed monumental figure moment ("31.4% more spend / 43.5% fewer purchases", Literata at 188px, spend in cobalt, the two figures staggered) → £638 / 0 purchases → every number arrives with its comparison (Figs. 3 and 4) → where the week's money went (Fig. 5, unchanged) → ask the account a question (Fig. 6) → evidence before explanation → close with three short how-it-works lines. The standalone agencies section folded into the close; the nav is Product and How it works. Captions set the source on two right-aligned lines so every caption fits two lines.

**Verification (headless Chrome DOM geometry, no screenshots):** at 1440 and 1280 no horizontal overflow, no crop slices visible text (the fading fifth ledger row is intentional), no SVG label leaves its drawing, the leader crosses no text and lands 14px left of its target, all markers sit inside their plates, all six reveals fire. Motion timings and reduced-motion behaviour are unchanged; the only addition is the leader waiting for its plate.

The production app, DESIGN.md and DECISIONS.md are untouched. No commit or push. **Manual visual approval is required before production translation.**

---

## 2026-10-03 — Landing page reset: premium software first (manual approval pending)

**Editorial Intelligence rejected after visual review.** The owner found it too magazine-like, too research-publication-like and too dependent on figure captions, callouts and analytical plates: interesting, but not an effortless premium software brand. The early concepts had been the opposite failure, polished but bland. The target is now premium software first, editorial discipline second: clean, spacious, confident, instantly understood, one strong idea per screen.

**New direction at `/landing-lab`** (one page; the earlier concept sources remain in the folder but are no longer rendered):

- **Hero:** "Know what changed before your client asks." in Host Grotesk 600 at 96px over two lines, a one-sentence support line, one filled "Try the demo" and a "See the product" text link. Nav: Product, How it works, For agencies, Sign in, an outlined Try the demo.
- **Product showcase (the one visual field):** the live Overview standing in a cobalt-to-navy field with a very soft texture drawn from sixty days of real campaign spend, bleeding off the base, plus one floating panel: the real Insights finding "Spend rose 31.4% while purchases fell 43.5%".
- **Sections, each one idea and one product panel:** Catch wasted spend (the zero-conversion finding through its suggested action); every campaign measured against its target (Campaigns summary strip and the ledger as two stacked crops, without the tabs, search and group row; four rows fading into a fifth) with three how-it-works lines; Ask the account a question (question, correction, figures and related findings down to "These are observations, not an attribution"); creatives carrying the account (format split and the two creatives leading by spend); Evidence before explanation (two sentences); close, "Know what changed before your next client call."
- **Removed:** serif display, figure numbers and captions, numbered callouts, the hatched engraving and break marks, monumental metric typography, footnote framing.
- **Kept:** warm ivory, deep ink, restrained cobalt, real product UI with seeded data, generous spacing, and the motion language (hero settles in, the product rises into its field with the floating finding following, each panel unveils top-down). Arming now happens before first paint, so nothing flashes; reduced motion shows everything static.

**Product treatment:** every panel is the shipped component rendered with the pinned Luxe Skin Co. workspace, cropped in its own coordinates and scaled so text stays legible (0.94–1.17 at 1440, 0.88–1.18 at 1280) and crisp. One small line under the showcase and the footer say the views use a seeded demo account.

**Verification (headless Chrome DOM geometry, no screenshots):** at 1440 and 1280 no horizontal overflow, headline lines fit, headline, support, both actions and the top of the product sit in the first viewport, no crop slices visible text except the intended bleed and fades, all seven reveals fire, no console errors.

DESIGN.md and DECISIONS.md are unchanged. No commit or push. **Manual visual approval is required.**

---

## 2026-10-03 — Pricing study (manual approval pending)

**Approved landing direction retained.** The premium-software-first landing page at `/landing-lab` passed visual review and is unchanged, apart from a temporary "Pricing" link in its nav pointing at the new study.

**Pricing exploration at `/pricing-lab`,** in the same language (Host Grotesk, warm ivory, deep ink, one cobalt field, low-radius buttons, thin borders) and the same motion grammar:

- **Single-plan strategy:** one Agency plan, £29 a month, with "Or £290 billed yearly, two months free" as a quiet secondary line. It's for small agencies managing up to 10 client accounts. No tiers, no comparison table, no "most popular" badge.
- **Structure:** nav with Pricing current; a two-tone hero ("Simple pricing. Built for agencies doing the work." with "Everything in Ad Analyst, for up to 10 client accounts."); one wide white plan panel set in the cobalt field (price, annual line, Try the demo, Sign in, and a note that trying the demo doesn't start a subscription), with the nine real capabilities listed beside it; an understated "Managing more than 10 client accounts? Contact us" line; "No feature gates."; six FAQs answered from the current product (CSV import today and a direct Meta connection later; no manual data entry; no automatic budget changes); "Evidence before explanation."; and the close.
- **Billing intentionally not implemented:** no Stripe, checkout, billing logic or API. Every action is Try the demo, Sign in or Contact us. "Contact us" has no destination yet because no sales address exists; in the study it lands on the FAQ answer about larger workspaces.
- **Motion:** the hero settles, the plan rises into its field and the price lifts into place a beat later. It is armed before first paint and static under reduced motion.

**Verification (headless Chrome DOM geometry, no screenshots):** at 1440 and 1280 there is no horizontal overflow, the headline wraps as set, the price sits inside the first viewport, all reveals fire, only the landing face loads, and there are no console errors. Text contrast is at least 3.70:1 for the large muted headline line and 5.01:1 for small text.

DESIGN.md and DECISIONS.md are unchanged; there is no permanent pricing decision yet. No commit or push. **Manual approval is required before the marketing site is translated into production.**

---

## 2026-10-03 — Marketing site translated to production (manual production approval pending)

**Approved:** the premium-software-first landing direction and the single-plan pricing page passed visual review. This pass translates both from `/landing-lab` and `/pricing-lab` into production routes without redesign; the labs stay as review references.

**Routing.** `/` was the app's Overview. The landing page now owns `/`, so the Overview moved to `/overview` (`APP_HOME` in `src/lib/routes.ts`). The page file moved unchanged, and the sidebar's Overview item points there through `src/features/navigation.ts`. The marketing pages live in a `(marketing)` route group with their own layout (Host Grotesk, shared nav and footer, no app shell). The root layout keeps the app shell, chosen by a small client `SurfaceSwitch` that reads the active top-level segment, so the shell persists across app navigation and is skipped for the marketing group. No app route folder moved.

**Auth behaviour (smallest change to the persistence work):** `/` and `/pricing` are public. A signed-in visitor at `/` or `/sign-in` is redirected to `/overview` (`redirect_app`, which replaces `redirect_home`). The sign-in page and the email callback land on `/overview`. Demo mode is unchanged: no proxy, and sign-in forwards to the app. Access tests are updated and extended.

**Links:** "Try the demo" goes to `/overview`, the existing demo experience in demo mode. In a Supabase deployment there is no public demo, so it leads to sign-in. That is an open product decision: host the demo as a separate demo-mode deployment, or add a public demo route. "Sign in" goes to `/sign-in`, and section links to `/#product`, `/#how-it-works` and `/#agencies`.

**Pricing:** one Agency plan, £29 / month, with "£290/year · 2 months free" as the secondary line. Nine real capabilities are listed. Try the demo and Sign in are the actions, with the note that the demo doesn't start a subscription. No billing, checkout, Stripe or subscription state was added. The FAQ answers are trimmed without changing their meaning. **Open decision:** there is no contact destination for workspaces above 10 clients, so the page says "Larger workspaces are available on request." as plain text, with no link.

**Shared marketing system (`src/features/marketing/`):** tokens, nav (an inline set from 1024px; below that a disclosure menu that closes on navigation and on Escape and returns focus), footer, the Host Grotesk face, and `RevealOnScroll`. Showcase pieces moved out of the lab: the pinned seeded evidence, `ProductCrop` (hidden until measured, so the server render never shows a product at the wrong scale), the client exhibit wrappers, the product canvases and the spend-field texture. The labs now import these.

**Motion** is unchanged in feel. Above-the-fold moments (hero settle, product rise, the finding following, the plan rise, the price lift) are CSS keyframes, so the server-rendered page never flashes. Panels below the fold unveil as they arrive, and anything already on screen at hydration is left visible. Reduced motion disables all of it.

**Responsive:** desktop crops render from 1024px. Below that, each showcase renders the real phone layout of the product at 375px, cropped to its point (Overview lead and KPIs; the finding and its figures; the Campaigns summary; the Ask correction and figures; the format split and leading creative). On phones the cobalt field runs edge to edge. Product text scales at 0.90–1.18 at every checked width, with no microscopic UI.

**Verification (headless Chrome DOM checks, no screenshots)** at 1440, 1280, 390 and 360 on `/` and `/pricing`:

- no horizontal page overflow and no crop slicing visible text, apart from the intended bleed and fades;
- one exposed heading level 1 per page, and the product views' own headings sit inside hidden showcases;
- the mobile menu opens, closes, closes on Escape and on navigation, and marks Pricing as current;
- anchors land, every reveal fires, and reduced motion is static;
- titles, descriptions and Open Graph text are present (no image, because none exists);
- the app shell is absent on marketing pages and present on every app route, with the correct active item;
- no console errors.

The production build was also served without configuration and with an unreachable Supabase URL to confirm signed-out access to `/`, `/pricing` and `/overview`. Signed-in redirects are covered by unit tests; there is no live Supabase project.

DESIGN.md has no marketing section yet, so it is unchanged; the marketing pages are not marked locked. No commit or push. **Manual review of the production renders is required.**

---

## 2026-10-03 — Final product polish before parking (manual approval pending)

**Scope:** a final pass on Clients, Settings and pricing, the `/overview` import routing fix, lab cleanup and docs. No new features. The approved landing page and the locked analytical surfaces are untouched apart from the import completion's destination.

**Clients.** Eight dense columns became five read left to right: Client (a 28px mark with the name first and business type · currency · account ID beneath), Source, Targets as one group, Data, and a quiet action. Concretely:

- Source reads "Meta Ads · CSV import" or "Demo dataset", with the last import or "Seeded · read-only" beneath.
- Targets show "CPA £28 / ROAS 3.5x" with "Not set" or "Not tracked" when missing.
- Data shows a status dot with the day count over the date range.
- The action is a "Select ›" text button instead of a filled button repeated down the table, with a check for the selected client.
- Rows are 69px instead of 40–56px.
- Below 768px the same rows become a labelled list. Identity and action share a line, the meta line wraps instead of truncating, and targets and data sit on single lines. Items are about 190–217px with 44px actions and no horizontal scroll.

**Settings.** The two-column grid of five icon cards became one 880px column of four hairline-separated sections, each with a heading and one line of context:

- **Account:** who is signed in, the workspace and sign-out; the agency and demo mode otherwise.
- **Client:** name, business type, currency, timezone and default comparison.
- **Performance targets:** the editable form for imported clients; read-only values with no inputs for demo clients.
- **Data:** source, coverage, ad account, the latest import, the import count and the conversion and value columns, with "Import a newer export" linking to the importer's existing `?client=` preselection.

The empty-workspace state uses the same sections. Nothing new is offered.

**Pricing.** The £29 Agency plan is unchanged. Below the cobalt field there is a secondary Enterprise row the same width as the plan panel: hairline-bordered, unfilled, with no price figure and no feature list. It reads "For agencies managing more than 10 client accounts. The same product, with room for every client." and "Pricing on request · Email us for pricing". The FAQ answer on larger agencies now names Enterprise. **Launch TODO:** there is no contact address in the repository, so "Email us for pricing" is plain text with no link (D-055).

**Routing.** "View Overview" after an import now selects the client and opens `/overview` directly through `openImportedClient` (`src/features/import/completion.ts`); it previously relied on the `/` redirect. The importer is otherwise unchanged.

**Lab cleanup.**

- Removed the six committed design labs (`ask-lab`, `campaigns-lab`, `creatives-lab`, `design-lab`, `insights-lab`, `sidebar-lab`). Their surfaces are approved, no production code imported them, and git history keeps them. This drops their 12 lab-only tests; the production Ask tests cover the same engine behaviour. Three of those lab files had small type adaptations from the uncommitted persistence pass; they went with the labs.
- Removed the rejected landing concepts and their art, fonts and leader, the unused round-1 screenshots in `public/landing-lab/` and the unused create-next-app SVGs in `public/`.
- Kept `/landing-lab` and `/pricing-lab` (the approved studies) because they were never committed, so git history does not preserve them. Their portal moved into `landing-lab`. Delete them after the marketing work is committed.

**Positioning:** unchanged and agency-first, recorded as a launch hypothesis (D-056).

**Tests (276 total):** completion routing to `/overview`; the Clients table with demo and imported clients (sources, grouped targets, "Not set" and "Not tracked", "No data yet", selected and select actions in both layouts); Settings (demo read-only with no inputs or sign-out; imported with labelled target inputs, a status region, the import link and sign-out; sections labelled by their headings); and the pricing page (the £29 Agency plan and annual line, the Enterprise copy, no `mailto:` or contact link, one H1).

**Verification (headless Chrome DOM checks, no screenshots):**

- Clients: no overflow at 1440, 1280, 390 or 360; the table shows from 768px and the list below; nothing truncated.
- Settings: four headed sections at 1440 and 390; demo mode shows no inputs.
- Pricing: the Enterprise row aligns with the Agency panel at 1440 and 1280 and spans the column on phones; the price stays above the fold; the heading order is H1, H2 Agency, H3, H2 Enterprise.
- Landing and Overview: unchanged.
- No console errors.

DESIGN.md (Clients, Settings, Account and §28 Marketing site), DECISIONS.md (D-054 to D-056) and PRODUCT.md (public site, billing not built) are updated. No commit or push. **Manual visual approval is required.**

---

## 2026-10-04 — Pricing: Enterprise made a first-class path (manual approval pending)

**Feedback:** the Agency composition is one of the strongest pieces of UI in the product, but the Enterprise row beneath the field read as an afterthought. A larger agency could fairly conclude Ad Analyst is a £29 small-agency tool.

**Change (pricing only):**

- The cobalt field now stages two equal white panels side by side. Agency (left) keeps its DNA: the 120px £29 with "/ month", "£290/year · 2 months free", Try the demo and Sign in, and the seeded-demo note.
- Enterprise (right) answers it with its own typographic moment: "Custom" at about 100px with "pricing" beside it. It reads "For agencies managing more than 10 client accounts.", "The same product, with room for every client.", a capacity row "More than 10 client accounts", "Email us for pricing" and "Quoted for the number of client accounts you manage. Prices in GBP."
- The two panels share a subgrid, so every row aligns across them, and each has a matching capacity row ("Up to 10" / "More than 10").
- The eight shared capabilities moved from Agency's list into one "Included in both plans" band beneath both panels, so the product is visibly the same and only capacity differs.
- The FAQ answer now says "custom pricing". No enterprise features were invented.
- "Email us for pricing" is still plain text: there is no contact address (launch TODO, D-055).

**Responsive:** below 1024px the panels stack, Agency first, then the shared band, inside the edge-to-edge field on phones. "Custom pricing" scales at the narrowest widths, keeping at least 20px spare from 360 to 1440. There is no overflow at 1440, 1280, 390 or 360, and tap targets are 44–46px. The motion (plans rise, prices lift) is unchanged.

**Tests:** the pricing test now checks two plan panels, the Enterprise copy, the shared list appearing once, and no contact link or `mailto:`. DESIGN.md §28 and the D-055 consequences describe the new composition. No other surface changed. No commit or push.

---

## 2026-10-04 — Wrap-up: final cleanup, commits and merge

**Cleanup:** removed the "Evidence before explanation." section from the landing page and the pricing page, along with its now-unused styles. Each page now flows straight from its last section into the closing call to action, with the existing section spacing. Removed `/landing-lab` and `/pricing-lab`: the approved designs now live in the production marketing pages, and nothing imports from them.

**State at parking:**

- The public site is at `/` and `/pricing`; the app starts at `/overview`.
- Pricing: Agency at £29 a month or £290 a year for up to 10 client accounts; Enterprise at custom pricing for more than 10.
- Agency-first positioning is a launch hypothesis.
- **Launch checkpoints, not started:** live Supabase and RLS validation, billing, a sales contact address, a public demo strategy for production, and deployment.

The work is committed in three commits (persistence and auth, the marketing site, final polish) and merged into `main` without squashing.

---

## 2026-10-04 — SEO and discoverability readiness (public site)

A technical pass on how the public site is crawled and indexed, made before any deployment. No redesign, copy rewrite or new pages; the landing and pricing pages render as before.

**Audit findings (production build):**

- In any non-demo deployment the proxy sent every unrecognised path to `/sign-in`, including `/robots.txt`, `/sitemap.xml` and mistyped URLs, so unknown URLs were soft 404s.
- No robots policy: the app and sign-in were indexable by default. No canonical tags, sitemap or robots file. The favicon was still the Create Next App icon.
- Already sound: unique titles on both pages, one H1 and a clean section outline on each, all marketing copy in the server HTML, metadata in the server-rendered head, no images (the visuals are live components and CSS), working anchors and CTAs, no lab links, no multi-hop redirects (`/pricing/` → `/pricing` is one 308; the app and sign-in redirects are one hop each), and fonts through `next/font` with preloads scoped per route and size-adjusted fallbacks.

**Changes (D-057, D-058):**

- Indexing: noindex by default from the root layout; `(marketing)` opts `/` and `/pricing` in. Verified: marketing pages `index, follow`; `/overview` (demo) and `/sign-in` `noindex, nofollow`; 404s `noindex`.
- Proxy: app pages are named in `APP_PATHS`; signed-out visitors to them still go to sign-in and the API still answers 401. Other paths fall through, so unknown URLs render a new not-found page with a 404 status (standalone when signed out, inside the shell in an app session).
- One origin source, `NEXT_PUBLIC_SITE_URL`, drives canonical and Open Graph URLs, `/sitemap.xml` (only `/` and `/pricing`) and the sitemap line in `/robots.txt`. Unset or localhost leaves them out. `/robots.txt` allows everything but `/api/` and `/auth/`.
- Metadata: home and pricing descriptions trimmed to 149 and 139 characters; pricing now mentions Enterprise. Open Graph adds site name, `en_GB` and the URL; cards stay text-only.
- Structured data on the home page: `WebSite` (with the origin) and `SoftwareApplication`, with no offers, ratings, reviews, FAQ or breadcrumbs.
- Favicon: the marketing mark as `icon.svg` plus a 1.8KB `favicon.ico` (16/32/48px), replacing the 25.9KB default.

**Performance, measured at 390px with 4× CPU and slow 4G:** LCP 1.5s (the hero lead), CLS 0, one 103ms long task, 86KB of HTML transferred (36KB with Brotli). Unchanged by this pass. Known costs, left as they are: the landing page's product exhibits render both desktop and phone variants of the real components, about 5,900 elements whose headings sit inside `aria-hidden`, `inert` crops; marketing pages render per request (`private, no-store`) because the root layout reads the session; and they load the app shell's JavaScript (about 40KB gzipped) through `SurfaceSwitch`. Moving the app shell into an `(app)` route-group layout would make the marketing pages static and drop that JavaScript; it touches every app route and is not needed for indexing.

**Tests:** route access (unknown URLs, robots and sitemap allowed; app pages and the API still protected; every page under `src/app` classified) and SEO (origin parsing, titles and descriptions, canonical with and without an origin, sitemap contents, robots rules, truthful JSON-LD, public links resolve with no lab routes).

**Not done here (launch-only):** setting the production origin, Search Console verification and sitemap submission, keeping previews out of search, validating JSON-LD on the live URL, Open Graph artwork, and off-site work such as backlinks. No commit or push.

## 2026-10-04 — Pre-deployment security audit and fixes

Audit of the whole repository before any deployment, then fixes for verified issues only. No redesign, no product features, nothing committed or pushed.

**Audit, clean:** no secrets in the tree, the `.env.example` history, the 19 commits of Git history or the build output (only `NEXT_PUBLIC_*` reaches the browser; the publishable key is public by design; no service-role key exists), so nothing needs rotating. RLS is on all ten tables and keyed on membership; composite foreign keys stop cross-workspace parents; `workspace_snapshot` and `import_meta_csv` check membership and resolve forged client IDs inside the caller's workspace; `anon` has no table or function privileges. Every route handler and server action re-checks the session next to the data, and client-supplied IDs (client, workspace cookie, Ask context) only select among rows the user can already read. No dynamic SQL, no SSRF surface (no server-side fetch), no open redirect (fixed targets only), no unsafe HTML (JSON-LD escapes `<`), no CSV export (so no formula injection). Errors reach users as fixed messages; logs carry Supabase/Postgres error text but no emails or file contents. `pnpm audit --prod`: no advisories.

**Found and fixed (D-059):**

- No security headers: added a same-origin CSP, frame denial, `nosniff`, referrer and permissions policies, HSTS outside development; `X-Powered-By` off.
- Supabase session cookies were script-readable and not `Secure` (`@supabase/ssr` defaults), contrary to D-049: now HTTP-only, and `Secure` in production, in both the proxy and the server client.
- With `NEXT_PUBLIC_SITE_URL` unset, the magic-link redirect was built from `X-Forwarded-Host`/`Host`: production now uses the configured origin only and refuses sign-in without it.
- `/api/import` had no rate limit: new `public.consume_rate_limit` (30 imports per user per hour, Postgres-backed), checked before the body is read; fails closed.
- `imports.imported_by` could be set to another user by a direct insert: the insert policy now requires `imported_by = auth.uid()`.
- `AD_ANALYST_ALLOW_SIGNUPS=false` looked like an access control but Supabase Auth can be called directly: documented that the Supabase setting is the real switch.

**Reported, not fixed:** direct PostgREST writes by a signed-in user to their own workspace bypass app validation and limits (MEDIUM; the fix reverses part of D-051 and needs a decision); sign-in requests share one Supabase per-IP bucket because they come from the server (MEDIUM; CAPTCHA plus host rate limiting); `braces` advisory in dev-only ESLint tooling, no patched version.

**Files:** `next.config.ts`, `src/lib/site.ts`, `src/lib/supabase/config.ts`, `src/lib/supabase/server.ts`, `src/proxy.ts`, `src/features/auth/actions.ts`, `src/features/auth/messages.ts`, `src/data/supabase/gateway.ts`, `src/data/supabase/test-database.ts`, `src/app/api/import/route.ts`, new migration `supabase/migrations/20261004200000_rate_limits_and_import_attribution.sql`, tests (`auth.test.ts`, `schema.test.ts`, new `src/app/api/import/route.test.ts`), `README.md` (new Security section), `.env.example`, `docs/DECISIONS.md`.

**Checks:** format, lint, typecheck, tests 295 → 307 (21 → 22 files; the three new route tests fail against the old route), production build, `git diff --check`, `pnpm audit`. Browser pass in dev (port 3000) and a production build in demo mode (port 3100): every app and marketing page loads with no CSP violations, Ask posts and the client switcher's server action work, HMR connects in dev.

**Live validation still required:** migrations applied to the real project, the two-user isolation check, redirect allow-list without broad wildcards, anonymous sign-ins off, sign-up setting, custom SMTP, Supabase auth rate limits and CAPTCHA, host rate-limit rules, preview deployments kept off the production project, spend caps.

## 2026-10-04 — Security follow-up: one controlled write boundary (M2)

Follow-up to the pre-deployment audit. It keeps every earlier fix and resolves the direct-write gap (M2). Nothing committed or pushed, and no migration applied to a live project.

**Mapped before changing grants:** the app never touches tables directly (`supabase.from` appears nowhere). Writes: `ensure_default_workspace` (definer; workspaces, workspace_members), `import_meta_csv` (invoker; clients, ad_accounts, campaigns, ad_sets, creatives, ads, daily_metrics, imports), `update_client_targets` (invoker; clients), `consume_rate_limit` (definer; rate_limits). Reads: `workspace_snapshot` (invoker), which needs `SELECT` on nine tables; nothing reads `workspace_members` directly. So no table needs a direct write grant.

**Changes (D-060):** new forward migration `20261004210000_controlled_write_boundary.sql`. Every privilege on the ten tables is reset, then `SELECT` is granted on the nine that `workspace_snapshot` reads. `import_meta_csv` and `update_client_targets` become `security definer` with an empty `search_path`, an `auth.uid()` check, explicit membership checks and input validation that matches the importer's own limits. The new `import_write` allowance (30 per hour) is counted inside the import transaction, and a refused write maps to a 429 (`GatewayError` kind `rate_limited`, shared `IMPORT_LIMIT_MESSAGE`). RLS policies are unchanged.

**Tests:** 8 new tests in `schema.test.ts` cover: owner direct writes refused on all ten tables; controlled writes still succeed; no write function reaches another workspace; forged workspace, client and user IDs fail; payload validation rejects 13 malformed cases and both bad target ranges without writing; future-dated rows still accepted; database write limit counts only committed imports; anonymous callers refused by every function. Four existing tests were updated, none weakened. Cross-workspace writes and import attribution now assert "permission denied", then restore the grant and show RLS still refuses. The composite foreign-key test runs as the table owner. The counter query filters by action. Against the schema without the new migration, 5 of the 23 schema tests fail (direct owner writes succeed, `"NaN"` spend is accepted, no write limit). With it, all pass.

**Checks:** `pnpm format:check`, `lint`, `typecheck`, `test` (315 passed, 22 files), `build --webpack`, `audit --prod` (no advisories), `git diff --check`.

**Still live work:** M3 (sign-in through the server shares Supabase's per-IP auth limit) stays deployment configuration: CAPTCHA, custom SMTP, tuned auth limits, host rate limits. The 13-item checklist is in README Security, including verifying that direct writes are refused on the real project.
