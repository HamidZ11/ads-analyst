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
