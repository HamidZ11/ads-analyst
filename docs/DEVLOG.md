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
