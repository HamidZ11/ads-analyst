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
