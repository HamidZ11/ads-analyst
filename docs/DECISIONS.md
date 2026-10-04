# Decisions

Lightweight records of settled architectural, product and design decisions. Reopen one only with a new entry that supersedes it.

Format: **Decision** · **Reason** · **Consequences**.

---

### D-001 — Seeded data precedes API integrations

**Decision:** Build on a deterministic, realistic seeded dataset before connecting any ad platform API or CSV import.
**Reason:** The product's value is the analysis layer. Realistic data with known patterns lets every later phase (charts, insight rules, AI explanations) be built and tested against a stable, reproducible baseline, offline.
**Consequences:** A repository interface (`src/data/repository.ts`) is the single read path so the seed can be swapped for a store later. Seed curves must stay realistic; tests assert the patterns. Demo data is anchored to today so trailing windows always have data.

### D-002 — Meta Ads is the first platform model

**Decision:** Model Meta Ads (account → campaign → ad set → ad → creative) first.
**Reason:** It is the dominant channel for the target agencies and has the richest creative-level story. Its hierarchy is a superset of what most paid-social platforms need.
**Consequences:** Entity names use Meta vocabulary (ad set, Advantage+). `AdAccount.platform` exists so a second platform can be added without renaming.

### D-003 — Deterministic insight rules precede AI explanations

**Decision:** Insights (what changed, waste, fatigue, scaling) will be computed by deterministic rules over the metrics before any model-generated explanation is layered on.
**Reason:** Findings must be reproducible, testable and defensible to a client. AI is for explanation and querying, not for discovering numbers.
**Consequences:** Seed data carries no pattern flags; rules must detect patterns from numbers (verified in `seed.test.ts`). The Insights page ships honest empty states until the rule engine exists. Ask Analyst is a query surface over the same computed facts.

### D-004 — Light, white, single-blue visual system

**Decision:** Light theme only; white surfaces on a cool-grey canvas, near-black navy text, blue as the only accent, pale-blue selection, hairline borders, minimal shadows.
**Reason:** Analysts read dense numbers for long sessions; a calm, high-contrast light system reads faster and prints/screenshots well for client reports. One accent keeps "selected" and "the series you are looking at" unambiguous.
**Consequences:** Tokens in `globals.css`; rules in `DESIGN.md`. Green/red are reserved for deltas. No gradients, no second hue. Tokens are structured so a dark theme can be added later without touching components.

### D-005 — Dense tables and compact charts

**Decision:** 13px body, 40px table rows, 16px card padding, six KPI tiles per row on desktop, controlled horizontal scrolling for tables on phones.
**Reason:** The audience compares many entities at once; density reduces scrolling and keeps comparisons on one screen. Hiding columns to avoid scrolling destroys the comparison.
**Consequences:** Tables always live in an `overflow-x-auto` wrapper. Density rules are in DESIGN.md §17.

### D-006 — No authentication initially

**Decision:** No auth, user accounts or hosted database in APP 01.
**Reason:** The product must run locally with zero setup during the foundation and analysis phases; auth adds nothing to validating the analytics.
**Consequences:** Client selection is a cookie preference, not a permission. Adding auth later means scoping the repository by workspace, not rewriting features.
**Superseded** by D-049 to D-051 for hosted deployments; demo mode still runs without sign-in (D-052).

### D-007 — Cookie-backed client and period context, server-rendered pages

**Decision:** The selected client and date preset are stored in cookies, read once per request in `getWorkspace()`, and changed through server actions.
**Reason:** Every page must reflect the current client. Server rendering keeps pages hydration-safe and lets a future persistent store be queried server-side. Server actions that set cookies re-render the page in one round trip.
**Consequences:** All routes are dynamic. Client components receive serialisable read models as props; they never import the repository.

### D-008 — Metrics stored once at ad level; everything derived

**Decision:** `DailyMetrics` holds only additive fields (spend, revenue, conversions, impressions, clicks) at ad level. Ratios and roll-ups are computed on demand.
**Reason:** Storing derived values creates inconsistency and double counting across the hierarchy and across date ranges.
**Consequences:** `src/domain/metrics.ts` is the only place ratios are defined. `entityType` remains on rows so imported data at coarser levels can coexist later.

### D-009 — Next.js App Router, Tailwind 4, Radix primitives only where needed

**Decision:** Next.js 16 App Router with TypeScript and Tailwind 4 tokens; `radix-ui` only for the client switcher menu and the mobile sheet; lucide-react icons; no shadcn CLI or copied component kits.
**Reason:** One coherent system with few dependencies. Radix provides keyboard and focus behaviour that is costly to hand-roll; everything else is simpler as plain markup.
**Consequences:** New components go in `src/components/ui/` and follow DESIGN.md. A chart library is deferred to APP 02 (see D-011).

### D-010 — Seed anchored to today's date in the agency timezone

**Decision:** The dataset ends on today's date (Europe/London) and is regenerated when the day changes. Patterns are defined by day index, so they keep their relative position.
**Reason:** "Last 7 days" must always have data for a living demo; fixed dates would rot.
**Consequences:** Numbers shift slightly day to day (weekday multipliers), patterns do not. Tests pass a fixed anchor for determinism.

### D-011 — Static SVG chart frames in APP 01

**Decision:** Ship static, single-axis SVG line frames and sparklines with real data; no chart library, no hover layer, no animation.
**Reason:** APP 01 is about framing and hierarchy; the interactive charting layer is APP 02's job and should be chosen with the date engine.
**Consequences:** Chart rules (one axis, 2px lines, three gridlines, muted earlier period) are fixed in DESIGN.md §13 so the library is styled to them, not the other way round.

### D-012 — DESIGN.md is the source of truth for visual decisions

**Decision:** Keep a concrete, rule-based `DESIGN.md` at the repo root and update it in the same pass as any visual change.
**Reason:** Later implementation passes (and agents) drift without explicit rules; prose philosophy does not prevent drift, measurable rules do.
**Consequences:** Code review checks changes against DESIGN.md. Reference material is summarised in §19 rather than copied.

### D-013 — Right rail is a fixed 340px contextual region

**Decision:** On ≥1024px the Overview (and future detail pages) use a main column plus a 340px right rail for contextual panels.
**Reason:** The reference screens use a narrower rail (~24% of width) than a thirds grid; a fixed width keeps panels readable at 1280 and leaves the main column for charts and tables.
**Consequences:** Rail panels must work at 340px; below 1024px the rail stacks beneath the main column.

### D-014 — Grouped primary navigation

**Decision:** Primary nav is grouped as "Analyse" (Overview, Campaigns, Creatives, Insights, Ask Analyst) and "Workspace" (Clients, Settings) with 11px uppercase labels.
**Reason:** Both reference products group navigation by intent; it scales when phases add pages and separates analysis from administration.
**Consequences:** New routes declare a group in `src/features/navigation.ts`.

### D-015 — Tokenised, transform/opacity-first motion with a mandatory reduced-motion guard

**Decision:** Motion uses exactly three durations (140/200/300ms) and three curves (enter, exit, standard) defined in `globals.css`; transitions name their properties; keyframes animate transform and opacity only, with one documented layout exception (the segmented indicator width); `prefers-reduced-motion` collapses everything.
**Reason:** State changes should read as continuous without the product feeling playful. Scattered durations and `transition: all` are the main sources of inconsistency and jank; reduced motion is an accessibility requirement, not a preference.
**Consequences:** New components take durations and easings from tokens only; code review rejects literal durations. Chart and number motion for APP 02 is specified in DESIGN.md §20 so the charting library is configured to the same tokens.

### D-016 — White page with open composition; containers only for tables, lists and single asides

> **Status: rejected after implementation review (2026-10-03). Superseded by D-017.** Kept for history; it is not an approved direction and the production UI no longer reflects it.

**Decision:** The page surface is white and content is composed as open sections with headings, whitespace and hairline dividers. The navigation rail is the only tinted region. Bordered containers are reserved for tables, ranked lists and the grouped KPI band; a borderless tinted panel is reserved for a single aside. Shadows are removed from static surfaces. The six KPI cards become one grouped band.
**Reason:** The first pass read as a dashboard template: every block boxed, six identical widgets, uppercase labels everywhere. The user's direction (ultra-clean analytical plus modern premium) is achieved through typography and spacing, not containers, and the primary reference screens group metrics with the chart rather than beside it.
**Consequences:** DESIGN.md §1, §3, §5, §7–§10 and §13 rewritten; `Card` has `outlined` and `subtle` variants and no shadow; `PageHeader` gains an eyebrow; table headers are sentence case; `KpiTile` is removed in favour of `KpiBand`. Later pages follow the same composition before reaching for a card.

### D-017 — APP 01.5 visual direction rejected; production UI restored to the APP 01 baseline pending a researched redesign

**Decision:** The APP 01.5 implementation of D-016 (commit `b6bc570`) failed manual visual review. Production UI (`src/`) and `DESIGN.md` are restored to the approved APP 01 commit `40eea2c`. D-016 is marked rejected rather than deleted. The design tooling, product context and research added afterwards (Impeccable, `PRODUCT.md`, `docs/design-research/`) are kept as the basis for the next direction.
**Reason:** The review found the result still category-interchangeable: no focal hierarchy, a type scale with no middle, hairline containers replacing card containers without changing the composition, and template chrome in the rail. Iterating on top of a rejected direction would compound it; a clean, approved baseline plus explicit references and critique tooling is the better starting point.
**Consequences:** The next visual pass starts from `40eea2c`'s UI and `DESIGN.md`, follows `docs/design-research/proposed-design-direction.md`, runs through Impeccable (`layout`, `typeset`, `distill`, `clarify`, `polish`, then `critique`), and rewrites `DESIGN.md` from the result. `docs/design-research/current-ui-critique.md` assessed the discarded 01.5 state; its typography, copy, chart, table and sidebar findings apply to the baseline as well and remain the working list.

> **Status of D-018 to D-028 (2026-10-03):** these decisions were adopted for the APP 01.6 implementation of `docs/design-research/visual-system-v2.md`. That implementation failed manual visual review the same day and was discarded uncommitted; production `src/` and `DESIGN.md` are back at the APP 01 baseline (`40eea2c`). The entries are kept as the record of the approved substitutions and the intent behind them; whether each survives is decided by the `/design-lab` composition round (D-029). Implementation details they mention (component names, token resets) no longer exist in `src/`.

### D-018 — Lead metric policy: the client's target-bearing efficiency metric leads the Overview

**Decision:** The Overview's single lead reading is return on ad spend when the client sets a ROAS target; otherwise cost per conversion when a CPA target is set; otherwise spend, read with conversion volume and cost beside it (`leadMetricFor` in `src/domain/lead-metric.ts`). The supporting strip holds spend and conversions first, then the remaining headline metrics, never the lead.
**Reason:** PRODUCT.md positions the product as "the client's own targets framing every number". The first question an analyst asks is "are we on target", and one figure with its target answers it; spend and volume are the context it is read at. A lead unrelated to the client's targets would be decoration.
**Consequences:** The policy is one pure function with tests; adding a target type means extending it, not the page. Luxe Skin Co. leads with ROAS, Peak Fitness and Arc Cloud with cost per lead / trial. Charting the lead metric itself (with its target line) is deferred to APP 02 because the strip, not the lead, is the chart's selector.

### D-019 — Previous period overlaid by day index

**Decision:** The primary chart's x-axis spans the selected period only; the previous period is drawn beneath it as a muted series aligned by day index (day 1 under day 1). The legend reads "{previous range} · day by day", the tooltip names both dates, and the figcaption states that alignment is by day number, not calendar date. One-day presets chart the trailing 14 days with the selected day shaded instead.
**Reason:** Direct comparison at every x matches how the audience reads Ads Manager and Stripe, keeps the full chart width for the period under analysis, and gives the tooltip a per-day delta. A trailing window with a shaded band answered a different question (long-run trend) that the 14D and 30D presets already answer.
**Consequences:** `getKpiReadings` splits every series into current and previous halves; `TrendChart` takes both plus their dates. Replaces the APP 01 "selected period band" except for one-day presets.

### D-020 — White page, grey rail, no static shadows

**Decision:** The page surface is `surface` (white); the navigation rail and mobile sheet are the only `canvas`-tinted regions. `--shadow-*` is reset so only `shadow-md` exists, for floating surfaces (menus, sheets, the chart tooltip).
**Reason:** On a grey canvas every white card competes; on a white page one outlined instrument can lead and open sections can be separated by whitespace. A second neutral layer belongs to the shell, not the content.
**Consequences:** `Card` loses its shadow; body background and `AppShell` change; D-004's "white surfaces on a cool-grey canvas" is inverted for the page and kept for the rail.

### D-021 — At most two outlined regions per view

**Decision:** A view may outline at most two regions (on the Overview: the instrument and the campaigns table). Everything else is an open section: a 16px title, an optional one-line subtitle, rows divided by hairlines or bars. Consecutive regions alternate outlined → open; never two outlined or two tinted regions touching.
**Reason:** APP 01.5 drew 41 hairline containers on one page and still read as a template; containers were compensating for weak proximity. Hierarchy comes from the grid, type, spacing and surface contrast.
**Consequences:** `SectionHeading` replaces card headers for open sections; the Overview rail, the creatives ledger and the account footer are open; the budget is checked by counting `rounded-lg border border-border` in rendered markup. Supersedes the "containers only for tables, lists and asides" wording of the rejected D-016 with a measurable rule.

### D-022 — Status as a dot; no status column

**Decision:** Entity status is a 6px dot before the name (`StatusDot`: `positive` active, `ink-faint` paused, `border-strong` archived) with visually hidden text; paused names render `ink-muted`. The status column, the badge and sorting by status are removed; the status words live in the filter chips.
**Reason:** Eight "Active" badges in a column said nothing; a dot carries the same fact without a pill, and the filter already answers "which are paused".
**Consequences:** `StatusBadge` is replaced by `StatusDot`; the campaigns table has nine columns; filtering replaces sorting by status.

### D-023 — 5% materiality threshold for change colour

**Decision:** Change values are coloured green or red only when the movement is both material (absolute relative change at or above `MATERIALITY_THRESHOLD = 0.05` in `src/domain/materiality.ts`) and directionally meaningful (the metric has a desirable direction; spend never does). Smaller changes render in `ink-secondary`. The lead delta and every position-against-target statement are always coloured.
**Reason:** When every delta is coloured, colour stops meaning "look here". Spend change has no desirability, which alone removes half the colour on a table.
**Consequences:** `Delta` gains `emphasis` ("material" by default, "always" for the lead) and a `threshold` prop; the constant is the only place to tune the rule. Screen readers hear ", not material" on neutral-coloured directional changes.

### D-024 — Creatives as a ranked ledger

**Decision:** The Creatives page is a ranked ledger: a frameless table with 72px rows holding a rank numeral, 56×70 portrait artwork, title and meta, spend with change, conversions, cost per conversion with its position against the client's target, ROAS or CPC, and CTR with change and a 72×20 sparkline. The rank follows the selected sort.
**Reason:** The card grid read as an ecommerce catalogue and gave every creative equal weight; a ranked ledger makes the best and worst creative visible at a glance and keeps the artwork as identity rather than merchandise.
**Consequences:** `CreativeCard` and `CreativeGrid` are removed; `CreativeThumbnail` gains a `portrait` frame; a gallery density is deferred until real imagery exists.

### D-025 — The rail is four grid columns from 1280px

**Decision:** The Overview rail occupies 4 of 12 grid columns from 1280px (`xl:col-span-4`; 363px at 1440, 309px at 1280). Between 768 and 1279 its two sections sit side by side beneath the instrument; below 768 they stack.
**Reason:** One grid for the whole page; at 1024–1279 a rail would leave the chart under 480px, which is too narrow for the instrument to lead.
**Consequences:** Supersedes D-013 (fixed 340px rail from 1024). Rail sections must work at 300px.

### D-026 — Sentence case everywhere; no tracked uppercase labels

**Decision:** No tracked uppercase labels anywhere: nav group labels, table headers, strip labels and metadata are sentence case at 12–13px. Hierarchy comes from size, weight and spacing.
**Reason:** All five references in `design-md-references.md` agree, and 11px uppercase labels were the strongest admin-template tell on the APP 01 pages.
**Consequences:** Amends the label style in D-014 (grouped navigation is kept). `Th` and `NavLinks` drop `uppercase tracking-wide`; `text-2xs` is now used for axis ticks only.

### D-027 — One chart on the Overview; account counts become a footer line

**Decision:** The Overview has one primary chart that shows the metric selected in the strip. The secondary daily-conversions chart and the Account card are removed; structure counts and data coverage become one 12px metadata line at the bottom of the page.
**Reason:** The 110px second chart was too small to read and too large to ignore; counts without comparisons did not earn a card. Conversions are one selection away in the strip.
**Consequences:** `TrendFrame`, `LineChart`, `AccountStructure`, `KpiTile` and `OverviewKpis` are removed; `TrendChart`, `Instrument`, `MetricStrip`, `LeadReading` and `AccountFooter` replace them. D-011 (static SVG frames) is narrowed: the chart now has a client-side hover and selection layer without a chart library; series morphing and number tweens remain APP 02.

### D-028 — Exactly one dominant visual object on the Overview

**Decision:** The Overview has exactly one dominant visual object: the instrument, which is the lead reading, the supporting strip and the primary chart in one outlined region. The strip supports it as the chart's selector; the rail supports it with spend concentration and the largest changes; nothing else on the page may compete with it in size, weight or colour. The lead numeral is the only 36px element; blue is limited to four elements per viewport (the active nav rule, the selected-metric rule, the chart series, one link or action).
**Reason:** The APP 01 Overview had no focal point and the APP 01.5 attempt replaced it with a flat band; both failed the three-second test. A single instrument gives the page an unmistakable reading order: health, what changed, the trend, where spend sits, what to investigate.
**Consequences:** Any future Overview module is judged by whether it supports the instrument; a module that competes is placed below the fold or on its own page. The budgets (one lead, two outlined regions, four blue elements) are checked in rendered markup before a pass is reviewed.

### D-029 — Composition before rules: a design lab decides the Overview direction

**Decision:** The APP 01.6 implementation of Visual System V2 is rejected after manual review (one large empty bordered panel, dead whitespace, no true focal point, an under-designed chart, lower content reading as raw rows, a rail that did not work, administrative typography). Production UI returns to the APP 01 baseline. Before any production redesign, a temporary, unlinked route `/design-lab` prototypes three materially different desktop Overview compositions on the seeded Luxe Skin Co. data: A "Analytical command surface", B "Modern product analytics", C "Premium data workstation". The owner selects one by looking at it.
**Reason:** Two written specifications (D-016, V2) produced implementations that read correctly on paper and failed in the eye. A written system constrains but does not compose; the composition must be chosen from rendered screens, then the rules are derived from the winner.
**Consequences:** `src/app/design-lab/` is isolated from production navigation and components (its own data model, chart geometry and sidebar; duplication is accepted), desktop-only at 1440px, and will be deleted or promoted after selection. The winner is then made responsive, abstracted into `src/components/ui/`, and `DESIGN.md` is rewritten from it. D-018 to D-028 remain the record of approved substitutions and are reconciled against the chosen concept.

### D-030 — Concept B is the production base; Concept C is a supporting reference

**Decision:** APP 01.7 translates Concept B — Modern Product Analytics — into production. Concept C contributes only stronger target-status treatment, a compact contextual rail, spend concentration, and ranked changes. Concept A is rejected and must not be reintroduced through equal KPI cards, card grids, or excessive panelisation.
**Reason:** Manual visual review preferred B for its immediate hierarchy, open composition, wide chart, and scanability. C adds useful investigation depth, but its pale-blue canvas, denser hero, and many simultaneous panels would weaken the product if copied wholesale. Human review supersedes automated critique scores for this direction.
**Consequences:** Overview, Campaigns, and Creatives share B's calm white analytical workspace. The design lab remains temporarily available and unlinked until the owner completes manual review of production at the requested widths.

### D-031 — Page entrance animation must not retain a transformed wrapper

**Decision:** The route page animation uses `backwards` fill rather than `both`.
**Reason:** `both` retains the animation's final `transform` on the route wrapper. That changes the containing block for `position: fixed` descendants, which is a real layout hazard for overlays and sheets. `backwards` preserves the entrance while returning the wrapper to its normal transform after completion.
**Consequences:** Fixed descendants are positioned against the viewport again. Any future page animation change must preserve this invariant or add a focused regression check.

### D-032 — APP 01.8 Overview approved and locked

**Decision:** On 2026-10-03 the owner approved the current Overview after manual visual review. Lock the existing B/C implementation, including the lower Top campaigns / What changed section, and preserve the unlinked design lab for future reference.
**Reason:** The visual correction checkpoint is complete; further visual iteration is neither needed nor authorised by the approval/commit task.
**Consequences:** Commit and push the complete verified state on `feat/foundation`, without further application changes, history rewriting or a sidebar redesign. New visual work requires a separate explicit brief. The successful Webpack production build is accepted for this checkpoint because the standard Turbopack build has an established environment-specific port-binding failure. This supersedes D-030's pending-review status, not its B/C direction.

### D-033 — Production sidebar adopts Concept B; the Overview remains the visual benchmark

**Decision:** After manual review of the three `/sidebar-lab` concepts beside the locked Overview, Concept B — Premium Workspace Nav — is selected for production. Concept A — Quiet Analytical Rail — was second and is not adopted. Concept C — Compact Professional Tool — is rejected. The production sidebar translates B faithfully: pale cool-grey rail, product mark with the agency beneath, a labelled white client switcher with pale-blue initials and a data-connection dot, sentence-case group labels, a white hairline-bordered active row with an ink label and a blue icon, one hairline before Workspace, and a white footer tile for the data state. The approved Overview (`8ba6437`, D-032) stays the visual benchmark the sidebar must sit quietly beside.
**Reason:** B read as a complete product shell: the client switch feels designed, the active state is clear without volume, the Workspace separation and footer are useful, and it stays visually quiet beside the Overview. A was too quiet to carry the client context; C's density and white rail belonged to a different kind of tool.
**Consequences:** Only shell files change (`sidebar`, `nav-links`, `product-mark`, `client-switcher`, `client-mark`); production client switching, Radix semantics and the mobile sheet keep their behaviour. The footer has no chevron because it has no action. `/sidebar-lab` remains unlinked as the reference until the production sidebar passes manual review. DESIGN.md §6, §7 and §10 carry the durable rules.

### D-034 — Production Campaigns adopts Concept B with target context from Concept C

**Decision:** After manual review of the three `/campaigns-lab` concepts beside the locked Overview and sidebar, Concept B — Campaign Performance Ledger — is the production base. Concept C — Campaign Command Table — contributes only the cost-against-target relationship under each cost value ("£110.83 over target") and the quiet one-row account summary above the ledger, translated into B's open composition. Concept A — Refined Analytical Table — is rejected. Human visual review remains authoritative over automated scores.
**Reason:** B has the better spacing, horizontal scanning, row hierarchy, room for long campaign names, grouping of related metrics, open composition and relationship with the Overview, and leaves room for drilldown and findings later. C's inline trend visuals, heavier framing and density were not adopted; its target relationship is the one idea that makes efficiency immediately readable.
**Consequences:** `campaigns-table.tsx` is rewritten as the ledger with real sorting, search and status tabs; `campaigns-summary.tsx` is new; the page drops the card frame and the roadmap note. The ledger's materiality threshold is 5% while the Overview's supporting metrics use 3%; reconciling the two is deferred to the global polish pass. No micro-trend sparkline is added. `/campaigns-lab` stays unlinked until the production page passes manual review. DESIGN.md §22 carries the durable rules.

### D-035 — Production Creatives adopts Concept C as the board and Concept B as the inspector

**Decision:** After manual review of the three `/creatives-lab` concepts, Concept C — Analytical Creative Board — is the production page: type breakdown, ranking by the active sort, two leaders with larger artwork, the rest as compact horizontal entries in ruled columns, a quiet idle strip, open composition. Concept B — Creative Analysis Split View — supplies the inspection interaction only: selecting a creative opens a right-side inspector with larger artwork, primary metrics with change and target context, a compact daily spend chart against the previous period, usage and a now / before / change table; it is not a permanent split. Concept A — Creative Performance Ledger — is rejected as the page structure because it repeats the Campaigns ledger with a thumbnail column. No global grey wash is applied; `surface-subtle` is used only for the selected entry, the filtered type cell and the artwork box. The inspector is factual only; no fatigue, winner or replacement classifications until deterministic logic exists. Human visual review remains authoritative.
**Reason:** C explains the creative mix at a glance, gives the leaders prominence without becoming a gallery, and gives Creatives its own identity beside the Overview; B's inspection answered "which creative should I inspect next" without leaving the page.
**Consequences:** `creative-grid.tsx` and `creative-card.tsx` are removed; `board-data.ts`, `creative-board.tsx`, `creative-inspector.tsx` and `creative-artwork.tsx` are new and Creatives-scoped. The inspector reuses the Overview chart geometry and Radix Dialog in non-modal mode; no dependency was added. `/creatives-lab` stays unlinked until the production page passes manual review. DESIGN.md §23 carries the durable rules.

### D-036 — Production Insights adopts Concept B as the workspace with the briefing from Concept C

**Decision:** After manual review of the three `/insights-lab` concepts, Concept B — Decision Workspace — is the production structure: a ranked list of findings on the left and the selected finding's evidence on the right. Concept C — Analytical Briefing — contributes only the one-sentence briefing generated from the real counts ("3 issues need attention, 3 opportunities and 2 things to watch for Luxe Skin Co. in the last 7 days.") and its grouping language (Needs attention, Opportunities, Watch) as the list's group labels; C's three full sections are not reproduced, so no finding appears twice. Concept A — Priority Analysis Feed — is rejected as the page structure. Priority labels stay locked to High impact, Opportunity and Watch; no scores, percentages of severity, health ratings or ranks. Human visual review remains authoritative over automated critique.
**Reason:** B reads as a decision workspace rather than an alert inbox: a fast ranked queue, clear priority, compact entity context and a deeper evidence pane with a chart only where a trend is the evidence, now / before / change, a suggested action and the reason it was flagged. C's sentence answers "what matters right now" before the user reads a single row.
**Consequences:** `src/features/insights/insight-sections.tsx` (the placeholder) is removed; `insights-workspace.tsx`, `finding-detail.tsx`, `finding-chart.tsx`, `priority.tsx`, `insights-model.ts` and `facts.ts` are new. Below 1280px the detail opens in the Creatives inspector's sheet pattern (non-modal Radix dialog, `rise-in` / `fade-out`). `/insights-lab` stays unlinked until the production page passes manual review. DESIGN.md §24 carries the durable rules.

### D-037 — The deterministic insight engine ships before any AI; findings are evidenced and advisory

**Decision:** Insights are produced by a deterministic engine in `src/domain/insights/` that runs ten detectors (zero-conversion spend, campaign deterioration, CPA spike, ROAS decline, CTR deterioration, creative fatigue proxy, spend concentration, underfunded winner, scaling winner, campaign improvement) over source-agnostic facts built from the repository for the selected client and period pair. No language model is called. Every finding carries the evidence that proves it (three or four metrics), a now / before / change comparison or a breakdown, the client's own target relationship when one exists, an advisory action written as a sentence, and a plain-language reason that states the rule. Actions are never executable from the product (no pause, budget or apply controls). Copy is observational: it states what changed and never names a cause; the fatigue detector says it is a proxy, not a measured cause. One finding per entity; ordering is priority, then the spend involved.
**Reason:** D-003 requires findings that are reproducible, testable and defensible to a client. Deterministic rules with visible thresholds let a user check every statement against the numbers, and they give any later AI explanation a fixed set of facts to explain rather than discover.
**Consequences:** Thresholds live in one exported object (`INSIGHT_RULES`) read by both the detectors and the reason copy, and are covered by unit tests on synthetic facts and integration tests on the seed (scenario detection, evidence recomputed from the repository, client and period isolation, vocabulary, no causal or execution language). Because the seed's daily noise is real, 7-day findings vary by anchor date; the 14-day view finds every documented Luxe Skin Co. pattern on every anchor tested. Persistent cost-over-target without a change (for example Overnight Repair in the 30-day view, five purchases on £2,653) is not a detector in this phase and is not flagged; a target-gap detector is a candidate for APP 05 proper. Human review of the rendered page remains authoritative.

## D-038 — Ask Analyst adopts Concept C and the refined composer

**Date:** 2026-10-03
**Decision:** The human-selected production base is Concept C — Hybrid Analyst Thread. Concept A is not selected; Concept B is rejected. Adopt the refined Beautiful UI-inspired compact composer and right-aligned user turn, not its demo card, tabs, timers or effects. Conversation controls the query; the active analytical answer dominates the workspace. Hide history until a previous answered turn exists. Keep `/ask-lab` until production passes manual review.
**Reason:** Preserves conversational continuity without making analysis read like a messaging app. Evidence, entity comparison and the next inspection remain the useful output.
**Consequences:** Existing product tokens and shell remain authoritative. Open answers, compact collapsed history, real follow-up queries and restrained coherent motion. No changes to the locked Overview, sidebar, Campaigns, Creatives, Insights, Clients or Settings. Production manual review remains required before commit.

## D-039 — Deterministic Ask facts, bounded context and no persistent chat

**Date:** 2026-10-03
**Decision:** Use an isolated local phrase-intent interpreter, deterministic facts, a structured serializable answer model and presentation. No approved external AI abstraction exists, so no LLM service is introduced. Reuse the Insights fact collector and detectors; add pure campaign-to-creative aggregation, metric comparison and explicitly defined efficiency ranking. “Strongest/weakest” means lowest/highest observed cost among entities meeting the existing minimum-outcome qualification, not predicted quality. Investigation keeps Insights order. Improvement uses relative outcome growth; deterioration uses relative cost increase among flagged campaigns. Limitations and ranking bases are visible.
**Reason:** Natural language may choose an analysis, but it must not decide what is true. Reusing detector outputs keeps thresholds in one place. Bounded interpretation can later be augmented without moving analysis into JSX or an LLM.
**Consequences:** The same-origin read-only `/api/ask` endpoint uses server-selected client/date cookies, validates question length and scope, verifies entity membership and rejects stale scope with 409. This preserves the existing seeded/demo architecture; it does not add authentication or tenant authorization. Context includes selected campaign/creative and the previous analytical entity, not arbitrary memory. Reused creative metrics remain campaign-scoped when following that campaign. Unknown/ambiguous references, unsupported language and differing requested periods require clarification rather than invented facts. No cause, benchmark or forecast is inferred.

Threads live only in the current mounted page. Start fresh clears answers and entity context; changing the actual client/current/previous date key resets automatically. A selected history turn restores its own context. AbortController cancels client response delivery (server computation is read-only and may finish); request IDs and scope guards reject stale responses. Pending and errors are real request states, not timed theatre. No saved conversations, persistence store, model dependency or new runtime dependency.

### D-040 — Real data enters through Meta Ads CSV import into the same normalised model

**Decision:** Real-data onboarding starts with Meta Ads Manager CSV exports (ad level, Day breakdown). Transport-specific code is isolated in `src/data/import/`: a strict CSV reader (`csv.ts`), the Meta column and value vocabulary (`meta.ts`), canonical import fields (`fields.ts`), validation (`validate.ts`) and normalisation and merge (`normalize.ts`). Validated rows become the existing canonical entities (client → ad account → campaign → ad set → ad → creative) and ad-level `DailyMetrics`; `composeDataset` appends imported clients to the seeded ones behind the unchanged repository contract. No page, Insights or Ask code branches on the source; the only source-aware UI is labelling (sidebar tile, Clients source column, Settings imports). The browser parses and validates for feedback; `/api/import` parses, maps and validates again and is the only writer.
**Reason:** The product's analytics must work whether data came from the demo seed, a CSV or a future API. A single normalised model keeps every surface and test valid, and keeps platform specifics out of shared domain code.
**Consequences:** Future sources (Meta API, TikTok, Google) are new adapters that produce the same rows. Demo clients are never import destinations and are never stored. Repository gained `getDataSource(clientId)` for audit labels; `Dataset` and `Workspace` carry source records. Limits: 10 MB, 100,000 rows, 200 columns, 2,000 characters per cell; ISO dates only; plain or thousands-grouped numbers only.

### D-041 — Duplicate policy: an import replaces the ad-days it contains and keeps every other day

**Decision:** Daily performance is keyed by client + ad + date (the ad is keyed by its platform ID, or by campaign/ad set/ad names when IDs are absent). An import replaces stored records for the ad-days it contains and adds the rest; stored days and ads it does not mention are kept. Within one file, identical rows count once (warning), conflicting rows for the same ad and day are refused (error), and rows split by a breakdown column (age, gender, placement, region…) are summed (warning).
**Reason:** Re-importing the same export must never double-count, and refreshing a recent period must not delete data from a narrower or filtered export. Replacing whole date ranges would silently erase campaigns missing from a filtered export.
**Consequences:** Repeating an import is idempotent ("0 new · 70 replaced"). Known limit: if Meta omits an ad from a later export because it had no delivery, that ad's earlier stored day stays until a later export includes it. Deleting imported data is not built yet.

### D-042 — The client's primary conversion is an explicit mapping; targets and revenue are optional

**Decision:** The column counted as conversions is chosen per import and recorded on the import. The mapper preselects only an obvious column for the business type (Purchases for ecommerce, Leads for lead generation, Trials/Registrations/Subscriptions for SaaS); a lone "Results" or "Conversions" column is proposed with a caution and checked against "Result indicator" (mixed result types are refused). Target CPA becomes nullable (`Client.targetCpa: number | null`) and `Client.revenueTracked` records whether conversion value is imported; ROAS is shown only when it is. A client that records value must map a value column on later imports.
**Reason:** "Results" means different events per campaign; inventing conversion semantics or a target would make every downstream comparison untrustworthy.
**Consequences:** Existing pages omit target language when no target exists (Overview lead metric falls back, Campaigns and Creatives hide the target line, Insights drops target clauses). Seeded clients keep their targets, so locked pages render exactly as before. Imported clients can set or clear targets in Settings; demo clients stay read-only.

### D-043 — Currency is explicit and single per client

**Decision:** Currency comes from the client setting and, when the export states it, from Meta's header suffixes ("Amount spent (GBP)") or a Currency column. A file with more than one currency, a currency other than GBP, USD or EUR, or a currency different from the destination client is refused. A file that states no currency is read in the client's currency with a warning. Symbols inside numeric cells are never parsed.
**Reason:** Mixing currencies or guessing from symbols produces wrong totals that look right.
**Consequences:** Currency, business type and timezone are fixed after a client's first import. Multi-currency accounts need a conversion strategy before they can be supported.

### D-044 — Imported data is stored in a local JSON file behind an import-store interface; hosted persistence is an open decision

**Decision:** `ImportStore` (`src/data/store.ts`) is the persistence boundary: `FileImportStore` writes one JSON file atomically to `AD_ANALYST_DATA_DIR` or `.data/` (git-ignored) for single-user, self-hosted use; `MemoryImportStore` serves tests. The repository rebuilds when the store's revision changes. An unreadable store never takes pages down and is never overwritten by an import.
**Reason:** The project has no database (D-006) and no approved hosting stack. A file store makes the import flow real and durable on a developer machine or single server without choosing infrastructure.
**Consequences:** **Open decision:** a hosted or multi-user deployment (serverless filesystems are ephemeral, there is no auth or tenant scoping) needs a database chosen and implemented behind `ImportStore`, with auth scoping the repository per workspace. Until then imported data is local to the server that received it.
**Superseded** by D-048: the file store, `ImportStore` and `.data/` are removed.

### D-045 — CSV imports never invent creative detail

**Decision:** CSV exports carry no artwork. Imported creatives use a new `{ kind: "unavailable" }` thumbnail rendered as a neutral square, and `CreativeType` gains `"unknown"` for exports without a format column. Without a creative ID or name column, each ad is treated as its own creative (named after the ad). Headline, body text and call to action are empty, so the inspector omits them.
**Reason:** Placeholder motifs suggest a kind of composition; using them for real ads would fabricate what the creative looks like.
**Consequences:** The Creatives breakdown adds a "Format unknown" cell only when such creatives exist and drops known-format cells only when nothing is known. A future Meta API adapter can enrich creatives with artwork and formats without schema changes.

### D-046 — Periods end on the last day with data when that is before today; missing delivery status is inferred and disclosed

**Decision:** `periodAnchor(today, lastDataDate)` ends the selected period on today, or on the client's last day with data when that is earlier. When an export has no delivery columns, entities that spent on the file's last day are marked active and the rest paused, and validation says so.
**Reason:** An export taken days ago would otherwise show empty "last 7 days"; seeded data always reaches today, so demo clients are unaffected. Status drives labels in Campaigns and must not silently default.
**Consequences:** For an imported client the period block shows the true dates (for example 24 Sep – 30 Sep 2026) even under the "7D" or "Today" presets; the sidebar shows data to the last day.

### D-047 — The import shows four user-facing steps over an unchanged seven-stage pipeline

**Decision:** Manual review found the importer too engineer-facing: seven equal steps, a long mapping table to read row by row, optional internal fields (delivery, objective, result indicator, creative and account columns) presented as if they needed attention, and validation that made the person feel responsible for technical details. The visible flow is now Upload → Review setup → Review import → Import. After upload the file is inspected and mapped automatically; Review setup shows what was detected and asks only for the client, the primary conversion when it is ambiguous, conversion value, optional targets, the timezone and the currency when the file does not state one. Full column mapping stays behind a collapsed "Advanced column mapping" disclosure that opens only when a required column is missing or a choice cannot hold its field. Blockers are limited to genuine uncertainty; anything that can be resolved safely is resolved and disclosed as "Handled automatically". The new-client business type is suggested from the outcome columns, and a generic "Results" column is never chosen silently.
**Reason:** Most exports map completely by alias; asking a person to confirm known mappings costs time and trust without adding safety. The decisions that need a person are few and should be the only ones asked.
**Consequences:** The pipeline (parse, inspect, map, validate, normalise, merge, server revalidation, import store) is unchanged, and the manual mapping, aliases, duplicate policy, currency checks and creative degradation all remain. Validation now reports a number field pointed at a column of dates or text as one column-choice error naming the field (the cause of the "invalid Day values" report), accepts the import's own currency symbol on amounts, skips total rows, ignores a time part on dates, and words every message around the field rather than the column. Dropdowns only offer columns that can hold the field.

### D-048 — Hosted persistence is Supabase Postgres behind the unchanged repository; the local file store is removed

**Decision:** Imported data lives in Supabase Postgres, created by versioned SQL migrations in `supabase/migrations/`. The schema is normalised: `workspaces`, `workspace_members`, `clients`, `ad_accounts`, `campaigns`, `ad_sets`, `creatives`, `ads`, `daily_metrics`, `imports`. Rows have stable UUID keys; platform IDs stay in `external_id`, and each structural row carries a deterministic `source_key` (`cmp_…`, `set_…`, `ad_…`, `cr_…`, hashed from the same identity the importer already used) that is unique per client. Every data row carries `workspace_id`, and children reference parents through composite foreign keys `(workspace_id, client_id, parent_id)`, so a row can never point at another tenant's parent. `daily_metrics` is keyed by `(ad_id, date)`. Pages keep reading the synchronous `AdAnalystRepository`: per request, one RLS-scoped function (`workspace_snapshot`) returns the workspace's clients, accounts, imports and coverage, plus the selected client's hierarchy and its last 120 days of metrics, which `src/data/supabase/snapshot.ts` maps into the existing `Dataset` (`SnapshotRepository` overrides coverage so the sidebar reports full history). Writes go through `WorkspaceGateway` (`src/data/supabase/gateway.ts`), which calls Postgres functions; no page or component queries Supabase.
**Reason:** A hosted, multi-user product needs a shared, durable store with tenant isolation the database enforces. Supabase gives Postgres, Auth and RLS in one service with no server we operate. Loading one snapshot keeps every locked page, Insights and Ask unchanged and testable.
**Consequences:** `src/data/store.ts`, `src/data/compose.ts`, `AD_ANALYST_DATA_DIR` and `.data/` are gone. Requests need one round trip for the snapshot; analyses look back at most 60 days, so the 120-day window has headroom. Very large clients may later need paged or aggregated reads. Migrations are applied with `supabase db push` or the SQL editor; there is no seed file because demo data is never stored (D-052).

### D-049 — Authentication is Supabase Auth with emailed one-time sign-in links

**Decision:** Sign-in is passwordless: the person enters an email, Supabase sends a one-time link (PKCE), and `/auth/callback` exchanges the code (or verifies a `token_hash` from a custom template) for a session held in HTTP-only cookies by `@supabase/ssr`. `src/proxy.ts` (Next.js 16 proxy) refreshes the session on every request and verifies it with `auth.getClaims()`; signed-out page requests redirect to `/sign-in`, signed-out API requests get 401, and only `/sign-in` and `/auth/callback` are public. The data access layer (`loadSession`) verifies the claims again, so access never relies on the proxy alone. The sign-in response is the same whether or not an address has an account; new addresses create accounts unless `AD_ANALYST_ALLOW_SIGNUPS=false`. Sign-out clears the Supabase session and the selection cookies.
**Reason:** It is the simplest secure default: no passwords to store, reset or leak, no extra UI, and Supabase handles rate limits and link expiry.
**Consequences:** The link must be opened in the browser that requested it (PKCE). The Supabase project needs email sign-in enabled and `<site>/auth/callback` in its redirect allow-list. Production email needs custom SMTP; Supabase's built-in sender is rate limited. OAuth providers and passwords can be added later without schema changes.

### D-050 — Workspace membership is the tenant boundary; one active workspace, multi-workspace UI deferred

**Decision:** User → workspace membership (`owner` or `member`) → workspace → clients → ad accounts → campaigns → ad sets → ads/creatives → daily metrics and imports. The schema allows many memberships per user and many members per workspace. On first sign-in `ensure_default_workspace` (a narrow `security definer` function, serialised per user with an advisory lock) creates "<Name>'s workspace" with the user as owner, and returns the user's memberships. The app uses one active workspace: the `aa_workspace` cookie may choose among the user's memberships, otherwise the oldest. There is no UI to switch, invite or manage members.
**Reason:** Agencies share clients between colleagues, so the model must not assume one user per tenant, but invitation and switching UI is a separate product step.
**Consequences:** Adding a member is a manual SQL insert for now (users cannot insert memberships themselves). Client names are unique per workspace, case-insensitively. An empty workspace shows "No clients yet" in the sidebar and sends analysis pages to the first import.

### D-051 — Row Level Security on every table is the authorization layer; no service-role key

**Decision:** RLS is enabled on all ten tables. The root rule is `is_workspace_member(workspace_id)` (a `security definer` helper so policies do not recurse into `workspace_members`). Members can read their workspaces and memberships; they can read and write clients and the data hierarchy only inside workspaces they belong to; imports are append-only (select and insert). `anon` has no table or function privileges. `workspace_snapshot`, `import_meta_csv` and `update_client_targets` are `security invoker`, so RLS applies inside them, and they also check membership explicitly. The app talks to Supabase only with the publishable key and the user's session; there is no service-role key anywhere.
**Reason:** Application filtering alone fails open on the first missed `where`; database policies make cross-tenant reads and writes impossible even for a bug or a forged request.
**Consequences:** Cookies (`aa_client`, `aa_workspace`) only express preference among rows the user can already read: a forged or stale client ID resolves to the workspace's first client, never to another tenant's. Errors from the database become fixed messages; "not a member" and "doesn't exist" read the same ("That client isn't available."), so tenant existence is never revealed.

**Amended** by D-060: users no longer write tables directly; imports and targets are written by `security definer` functions with explicit membership checks. RLS still governs every read.

### D-052 — Demo data is a deployment mode, never stored in or mixed with a workspace

**Decision:** The seeded dataset (D-001) is generated in code and served only in demo mode: `AD_ANALYST_DEMO_MODE=true`, or `pnpm dev` without Supabase variables. Demo mode has no sign-in, no database and no writes; imports answer "Imports need a connected database" and demo clients stay read-only. With Supabase configured, workspaces contain only data their members imported. A production build without configuration shows "Not connected yet" rather than demo data.
**Reason:** Mixing fixtures into tenant data would put invented numbers next to real ones and complicate deletion and isolation. Keeping the demo in code keeps the locked pages reviewable with zero setup.
**Consequences:** No seed migration. Design labs keep reading the demo repository directly. A future "sample client" for onboarding would need its own explicit, labelled decision.

### D-053 — An import is one Postgres function call: atomic, idempotent and recorded

**Decision:** `/api/import` re-parses and re-validates the CSV as before (D-040 to D-047), then sends a key-based payload to `import_meta_csv(workspace, payload)`. The function runs in one transaction: it checks membership, creates the client or finds it inside the workspace, upserts the ad account (refusing a different account ID), upserts campaigns, ad sets, creatives and ads on `(client_id, source_key)`, verifies every metric row resolves to an ad of this client, upserts `daily_metrics` on `(ad_id, date)` (D-041: replace the ad-days in the file, keep the rest), and inserts the `imports` record (file name and size, rows, dates, account, currency, conversion and value columns, new and updated ad-days, importing user). Any failure rolls the whole import back. Targets are saved through `update_client_targets`, which only touches a client the caller can see.
**Reason:** A half-written import would corrupt totals silently. Database keys, not application bookkeeping, are what make re-imports idempotent under concurrency.
**Consequences:** Re-importing the same file adds 0 ad-days and updates 70; an overlapping export updates the overlap and adds the rest. A creative's known format is kept when a later export has no format column. Two people importing the same new client name at once: the unique index lets one win and the other is told "A client called … already exists." (names are unique per workspace, so this never reveals another tenant). Deleting imports is still not built.

**Amended** by D-060: `import_meta_csv` and `update_client_targets` now run with owner rights and validate their input; the transaction and upsert behaviour is unchanged.

### D-054 — The public site owns `/`; the app starts at `/overview`

**Decision:** The marketing pages (`/` landing, `/pricing`) live in a `(marketing)` route group with their own layout and no app shell. The Overview moved from `/` to `/overview` (`APP_HOME` in `src/lib/routes.ts`). The root layout keeps the app shell and skips it for the marketing segment, so the shell persists across app navigation. `/` and `/pricing` are public. A signed-in visitor at `/` or `/sign-in` is sent to `/overview`, and sign-in, the email callback and "View Overview" after an import all land there.
**Reason:** A public product needs a public front door, and agencies already in the product should not have to pass through marketing to reach their work.
**Consequences:** "Try the demo" points at `/overview`. That is the seeded demo in a demo-mode deployment; a Supabase deployment has no public demo, so it leads to sign-in until a demo deployment or route is decided.

### D-055 — One Agency plan at £29 a month; larger workspaces are Enterprise on request

**Decision:** Ad Analyst has a single plan, Agency: £29 a month, or £290 a year (two months free), for up to 10 client accounts, with the whole product included. Agencies with more than 10 client accounts are served as Enterprise, priced on request. Enterprise is a secondary treatment that differs only in capacity; it is not a second tier with its own features. Billing is not implemented.
**Reason:** Early pricing should be simple to read and honest about what exists. Splitting analysis across tiers would gate the product's core value, and inventing enterprise features (SSO, SLAs, API access) would claim capabilities that do not exist.
**Consequences:** The pricing page shows Agency and Enterprise as two equal panels, with the shared product listed once beneath them, so larger agencies read as a first-class path rather than an afterthought. There is no contact address yet, so "Email us for pricing" is plain text. A contact destination is a launch prerequisite, as are billing and the >10-client mechanism itself.

### D-056 — Agency-first positioning is a launch hypothesis

**Decision:** The product and marketing stay positioned for small marketing agencies managing several Meta Ads clients ("Know what changed before your client asks").
**Reason:** The product is built around agency workflows (multiple clients, per-client targets, client-facing reporting). Small-business owners were the original alternative and remain plausible, but there is no customer evidence yet either way.
**Consequences:** Treat the positioning as the current hypothesis to test at launch, not a proven market. Repositioning toward small businesses is a later decision to make from evidence; the product's single-client experience would need its own review then.

### D-057 — Only the marketing pages are indexable; unknown URLs are real 404s

**Decision:** The root layout sets `robots: noindex, nofollow` for every route and the `(marketing)` layout opts `/` and `/pricing` back in. The production origin comes from one variable, `NEXT_PUBLIC_SITE_URL` (`src/lib/site.ts`); with it, the marketing pages get canonical and Open Graph URLs, `/sitemap.xml` lists exactly the marketing URLs, and `/robots.txt` names the sitemap. Unset, invalid or localhost values leave all three out. robots.txt allows everything except `/api/` and `/auth/`. The proxy now names the app's pages (`APP_PATHS`): signed-out visitors to them still go to sign-in and the API still answers 401, but every other path falls through to the app, so robots.txt, the sitemap and icons are served, and an unknown URL gets the not-found page with a 404 status.
**Reason:** Before this, the proxy sent every unrecognised path to `/sign-in` in any non-demo deployment, including robots.txt and the sitemap, so unknown URLs were soft 404s and crawlers could not read crawl instructions. Nothing marked the app or sign-in as non-indexable. Every app page and API route already verifies the session itself (`getWorkspaceContext` redirects, the API returns 401) and RLS guards the data, so the proxy redirect is a convenience, not the protection.
**Consequences:** A new app page must be added to `APP_PATHS`; a test fails if any page under `src/app` is neither public nor an app page. A new public page belongs in `(marketing)` and `MARKETING_PATHS`, which also puts it in the sitemap. App pages and sign-in are not disallowed in robots.txt, because the site links to them and crawlers must fetch them to see their noindex. Previews and staging must be kept out of search at the host.

### D-058 — Structured data and share metadata stay truthful

**Decision:** The home page carries JSON-LD for `WebSite` (name and canonical home URL, only when the origin is configured, for the site name in results) and `SoftwareApplication` (name, `BusinessApplication`, operating system "Web", and the hero lead as description). There are no offers on the home page, because prices are not shown there, and no `aggregateRating` or `review`, because none exist. No FAQ schema: Google limited FAQ rich results to authoritative government and health sites in 2023 and removed them from Search on 7 May 2026. No breadcrumbs on a two-page site. Open Graph and Twitter cards are text-only (`summary`) until approved artwork exists. The Create Next App favicon is replaced by the marketing mark (an ink rounded square with the white chart line), as `icon.svg` with a 16/32/48px `favicon.ico`.
**Reason:** Structured data that is not visible on the page, or that invents reviews, risks manual actions and misleads. Without a rating or review, `SoftwareApplication` is not eligible for Google's software rich result; it is kept because it describes the product accurately for search engines and other readers.
**Consequences:** Add `offers` (price and GBP) on the page that shows them once billing exists, and ratings only from real reviews. The app's sidebar mark (an "A") differs from the marketing mark used for the favicon; choosing one mark for both is an owner decision.

### D-059 — Pre-deployment security baseline: headers, HTTP-only sessions, configured sign-in origin, per-user import limit

**Decision:** Every response carries a same-origin Content Security Policy from `next.config.ts` (`default-src 'self'`, inline scripts and styles allowed, `'unsafe-eval'` in development only, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`), plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a permissions policy that turns off camera, microphone, geolocation and topics, and HSTS (two years, no `includeSubDomains`) outside development; `X-Powered-By` is off. Supabase session cookies are HTTP-only, and `Secure` in production (`sessionCookieOptions`), which makes D-049's "HTTP-only cookies" true: `@supabase/ssr` defaults to script-readable cookies, and the app has no browser Supabase client. Production sign-in links return only to `NEXT_PUBLIC_SITE_URL`; without it, sign-in is refused rather than built from `Host`/`X-Forwarded-Host`. `/api/import` spends one unit of a per-user allowance (30 per hour, fixed window) in `public.consume_rate_limit` before reading the body, and fails closed when the check is unavailable. The `imports` insert policy also requires `imported_by = auth.uid()`.
**Reason:** A pre-deployment audit found no cross-tenant path, no committed secrets and no production dependency advisories, but found no security headers, script-readable session cookies, an auth redirect built from request headers when the origin was unset, no limit on the most expensive endpoint, and audit records that could name another user. Nonces were not used: they would tie every page to per-request rendering and the proxy, and no unsafe HTML sink exists to justify that yet. The limiter lives in Postgres because it keys on `auth.uid()`, which a caller cannot forge, and holds across serverless instances.
**Consequences:** A production deployment must set `NEXT_PUBLIC_SITE_URL` (preview deployments too, or sign-in is off there). Local production builds over plain HTTP work in Chrome and Firefox (localhost counts as secure) but Safari may drop the `Secure` session cookie. Adding a third-party script, font or API means widening the CSP. Not changed, and accepted for now: (1) direct PostgREST writes by a signed-in user to their own workspace bypass app validation and the import limit; closing that means revoking direct table writes and moving writes into `security definer` functions with explicit checks, which reverses part of D-051 and needs its own decision; (2) sign-in requests reach Supabase from the server, so its per-IP auth limits act as one shared bucket; the fix is Supabase CAPTCHA (a sign-in form change), a host rate-limit rule, and tuned Supabase limits, not an in-process limiter that would not hold across instances. Ask Analyst is deterministic, with no paid API, and costs the same as a page view, so it gets no separate limit.

**Amended** by D-060: limit (1), direct writes, is resolved; limit (2) remains live configuration.

### D-060 — Users write only through database functions; no table is directly writable

**Decision:** Resolves the direct-write gap left open in D-059. `authenticated` keeps `SELECT` on the nine tables `workspace_snapshot` reads and loses every write privilege, plus `SELECT` on `workspace_members`, which only `security definer` functions read. The write boundary is four functions: `ensure_default_workspace` (unchanged), `consume_rate_limit`, `import_meta_csv` and `update_client_targets`. The last two become `security definer` with an empty `search_path`: each requires `auth.uid()`, checks membership explicitly (the workspace for imports, the client's own workspace for targets), and validates input before writing, failing closed. `import_meta_csv` checks the payload's shape, list sizes (at most 100,000), key, name and ID lengths (64/300/64, as the importer cuts them), header lengths (2,000), metric values as JSON numbers, dates as `YYYY-MM-DD`, file size (10 MB), row count, client mode, timezone (against `pg_timezone_names`) and target ranges; enumerations, signs and numeric ranges stay with the table constraints; `imported_by` is set from the caller. A new `import_write` allowance (30 per user per hour) is spent inside the import transaction, so only committed imports count; `/api/import` still spends `import` (30 attempts per hour) before reading a file. A refused write maps to 429. `workspace_snapshot` stays `security invoker`, so reads stay under RLS. The RLS policies are unchanged.
**Reason:** The server cannot be distinguished from a user at the Data API: both call with the user's session and the publishable key, and there is no service-role key (D-051). So the database function, not the route, has to be the controlled boundary, and table write privileges have to go. Owner rights are the standard way to let a function write what its caller cannot; the explicit checks replace RLS inside the two writers, and RLS stays on as defence in depth (tests restore a write grant and show the policies still confine writes).
**Consequences:** The app behaves exactly as before; validation limits match what the importer produces, and future-dated rows are still accepted because the importer only warns about them. A rolled-back import is not counted against `import_write`, so repeated failing calls cost database time but store nothing; host rate limits cover request floods. Adding a write path now means adding or extending a function with the same checks, never a table grant. The migration is forward-only (`20261004210000_controlled_write_boundary.sql`) and needs a live check that direct writes are refused (README Security, item 3).
