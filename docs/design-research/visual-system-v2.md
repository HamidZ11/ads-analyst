# Visual System V2 — "The analyst's instrument"

**Status:** design specification for review. Nothing here is implemented. `src/` and `DESIGN.md` are untouched; the production UI remains the approved APP 01 baseline (`40eea2c`, restored in `3b56cdf`).
**Date:** 2026-10-03. Branch `feat/foundation`.
**Scope:** Overview, Campaigns, Creatives and the shell (sidebar, page header). Insights, Ask Analyst, Clients and Settings inherit the rules without being recomposed here.
**Method:** Impeccable `shape`, `layout` and `typeset` playbooks run against the APP 01 Overview (assessments inline, declared in Appendix B), the `premium` and `clean` style skills used as precision and restraint checks, the five DESIGN.md references in `design-md-references.md` used for rules only. PRODUCT.md and our own constraints win every conflict with a skill.

Values quoted as examples are the live seeded figures for Luxe Skin Co., 27 Sep – 3 Oct 2026 vs the previous 7 days, as rendered by the dev server today. Daily chart values are illustrative.

---

## 0. Decisions for review

These are the calls the brief delegated. Each has a recommendation and a reason; approve, flip, or annotate. Everything else in the document follows from them.

| #   | Decision                                              | Recommendation                                                                                                                                                                                          | Why                                                                                                                                                                                                   |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which metric leads the Overview                       | The client's **target-bearing efficiency metric**: return on ad spend when the client sets a ROAS target, otherwise cost per conversion. Spend and conversions are the first two supporting metrics.    | PRODUCT.md positions the product as "the client's own targets framing every number". The lead reading answers "are we on target" in one figure; spend and volume are the context it is read against.  |
| 2   | How current vs previous period is drawn on the chart  | **Overlay**: the x-axis spans the selected period only; the previous period is drawn as a muted series aligned by day index. The 30-day trailing window with a shaded band is dropped.                  | Direct comparison at every x, matches what the audience sees in Ads Manager and Stripe, and keeps the full chart width for the period being analysed. Longer context is one preset away (14D, 30D).   |
| 3   | Page and rail surfaces                                | **White page, cool-grey rail** (`canvas`). Static shadows removed. Two outlined containers per view at most.                                                                                            | A white page lets one bordered instrument lead; on the grey canvas every card competes. The rail as the only tinted region gives the shell a second neutral layer (Operate guidance) without chrome.  |
| 4   | Status and change colour in tables                    | Status column removed; a 6px dot before the campaign name. Change values coloured only when the change is **material (≥ 5 %)**; smaller changes render neutral.                                         | Colour must mean "look here". In the baseline every delta is coloured and eight "Active" badges say nothing.                                                                                          |
| 5   | Creatives layout                                      | **Ranked ledger** (72px rows with 56×70 artwork, title, meta, numbers right) replaces the card grid.                                                                                                    | Rows make the best and worst creative visible at a glance and cannot read as a catalogue; the rank numeral is the position cue the critique asked for. A gallery density is a later, optional toggle. |
| 6   | Rail width and breakpoint                             | The rail becomes **4 of 12 grid columns from 1280px** (363px at 1440, 309px at 1280); below 1280 it stacks under the instrument as two side-by-side sections. Supersedes D-013 (fixed 340px from 1024). | One grid for the whole page; at 1024–1279 a rail would leave the chart under 480px.                                                                                                                   |
| 7   | Uppercase labels                                      | **No tracked uppercase anywhere**: nav group labels, table headers and strip labels are sentence case. Amends the label style in D-014 (grouping stays).                                                | All five references agree; uppercase 11px labels are the strongest admin-template tell on the current pages.                                                                                          |
| 8   | What happens to the second chart and the account card | One chart. The daily conversions small multiple is dropped; conversions are one selection away (APP 02). Account structure counts move to a one-line metadata footer.                                   | The 110px second chart was "too small to read and too large to ignore"; counts without comparisons do not earn a card.                                                                                |

---

## 1. Visual thesis

Ad Analyst is an instrument for reading advertising performance. The page is organised around **one reading, one trend, and the facts that explain them**, in that order. The design expresses the product's own truths, which the APP 01 pages hold in their data but not in their form: every number is read against a target or a previous period; one client drives everything; findings are computed before they are explained.

The world lends four things and nothing else (Impeccable's Operate rule): **type** (Inter, one family, a real scale with a middle), **palette** (white and cool grey, navy ink, one blue, green and red as text only), **density** (13px body, 40px rows, generous space between sections and none inside components) and **one signature move**:

> **The instrument.** On the Overview the lead reading, the metric strip and the chart are one bordered object. The strip is the chart's legend and selector: the metric being charted carries a 2px blue rule on the strip's bottom edge, and the same blue is the series beneath it. Nothing else on the page is boxed except the table.

That 2px rule is also the system's one mark for "current": the active nav item, the charted metric, the active sort arrow. Blue therefore has exactly two meanings on every screen: _the thing you are looking at_ and _the series you are reading_. Everything else is ink.

The reading order within three seconds of opening a client:

1. **Account health** — the lead reading: `2.71x` return on ad spend, its change, its position against the 3.5x target.
2. **What materially changed** — the strip's coloured deltas (only material ones are coloured) and the "Largest changes" rail section.
3. **The dominant trend** — the chart, 280px tall, the current period in blue over the previous period in grey.
4. **Where spend is concentrated** — "Spend by campaign" at the top of the rail, bars in ink, not blue.
5. **What deserves investigation** — the largest changes, then the campaigns table below the fold with cost against target.

Tone: calm and institutional in its surfaces (Coinbase, Carbon), sharp in its type and number setting (Vercel, Stripe), restrained in its states (Cal.com). Screenshot-worthy because the hierarchy survives being shrunk to a phone screen or pasted into a client email.

---

## 2. Principles

Measurable, so a review can fail a change against them.

1. **One reading leads.** Every page has exactly one element at the top of the type scale. On the Overview it is the lead numeral (36px). On Campaigns and Creatives it is the page title (22px); the data is the lead.
2. **Numbers have their own register.** A numeral is always one weight step heavier than the text beside it (500 next to 400, 600 next to 500) and is tabular whenever it sits in a column, tick or inline comparison. Standalone numerals at 20px and above use proportional figures.
3. **Every number carries its comparison or its target**, on the same line or the line beneath, in words a client can read ("£1.12 under target", "from 2.62x").
4. **Colour has two jobs.** Blue marks what is current or charted. Green and red colour text that reports a material change or a position against target. Neither is ever a fill, a heading, an icon at rest or a border.
5. **One grid.** Twelve columns, 24px gutters. Every section's edges fall on column edges. No section invents its own split.
6. **Containers are earned.** At most two outlined regions per view. Hairlines divide rows inside a list or table; they do not frame sections. Whitespace separates sections.
7. **Sentence case, always.** No tracked uppercase. Hierarchy comes from size, weight and spacing, not from capitals or a fourth grey.
8. **Three inks per view.** `ink`, `ink-secondary`, `ink-muted` do the work; `ink-faint` is reserved for ticks, placeholders and rank numerals.
9. **Density with rhythm.** Tight inside a component (4–8px), moderate between related rows (12px), generous between sections (32px). Never one interval repeated until everything weighs the same.
10. **Honest surfaces.** No roadmap copy in the UI. Empty states say what will appear and what produces it. Nothing animates to decorate (DESIGN.md §20 stands).

---

## 3. Page grid

One desktop grid, used by every page.

| Property                | Value                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Sidebar                 | 240px fixed from 1024px (unchanged). Content area = viewport − 240.                                                |
| Page gutters            | 32px at ≥ 1024, 24px at 640–1023, 16px below 640.                                                                  |
| Content width           | `min(1200px, content area − 2 × gutter)`, left-aligned to the gutter (not centred; centring wastes the rail edge). |
| Columns                 | 12, gutter 24px. Column width at 1440: 72.7px; at 1280: 59.3px.                                                    |
| Instrument / chart span | 8 columns: 749px at 1440, 642px at 1280.                                                                           |
| Analytical rail span    | 4 columns: 363px at 1440, 309px at 1280. Rail sections never narrower than 300px.                                  |
| Full-width sections     | 12 columns (tables, the creatives ledger, the page header).                                                        |
| Vertical rhythm         | Header → first section 24px. Between sections 32px. Between a section title and its body 12px. Footer line 32px.   |
| Page padding            | 24px top, 32px bottom at ≥ 1024; 20px/24px below.                                                                  |

Breakpoint behaviour (structural, not fluid):

- **≥ 1280:** instrument 8 + rail 4. Below the fold, full width.
- **1024–1279:** instrument 12; the two rail sections sit side by side beneath it (6 + 6).
- **768–1023:** everything 12 wide; rail sections stacked; strip in one row of five if ≥ 640px of inner width, otherwise 3 + 2.
- **< 640:** strip 2 columns; lead numeral 30px; chart 200px tall; tables scroll inside their frame; ledger rows collapse to artwork, title, spend and cost.

Verified widths remain 1440, 1280, 390, 360.

---

## 4. Typography system

Inter via `next/font`, system-ui fallback. One family. Weight ceiling 600. Fixed rem scale; nothing fluid. Tracking tightens with size (Vercel), ticks carry a touch of positive tracking (Carbon).

### Scale tokens (proposed `globals.css` changes)

| Token       | Size / line | Change from APP 01       |
| ----------- | ----------- | ------------------------ |
| `text-2xs`  | 11 / 16     | kept; ticks only         |
| `text-xs`   | 12 / 16     | kept                     |
| `text-sm`   | 13 / 20     | kept; body               |
| `text-base` | 14 / 20     | line 22 → 20             |
| `text-lg`   | 16 / 24     | kept; section titles     |
| `text-xl`   | 20 / 28     | was 18 / 26              |
| `text-2xl`  | 22 / 28     | kept; page title         |
| `text-3xl`  | 30 / 36     | was 26 / 32; mobile lead |
| `text-4xl`  | 36 / 40     | new; lead numeral        |

Tracking tokens: `tracking-tight-1` −0.01em (16–18px), `tracking-tight-2` −0.02em (20–22px), `tracking-tight-3` −0.03em (30–36px), `tracking-wide-1` +0.01em (11px ticks). No other letter-spacing values.

### Roles

| Role                               | Size / line | Weight | Tracking | Colour                                                                  | Figures      |
| ---------------------------------- | ----------- | ------ | -------- | ----------------------------------------------------------------------- | ------------ |
| Page title                         | 22 / 28     | 600    | −0.02em  | `ink`                                                                   | —            |
| Account / client context           | 13 / 20     | 400    | 0        | `ink-muted`; client name `ink-secondary` 500                            | tabular      |
| Lead numeral                       | 36 / 40     | 600    | −0.03em  | `ink`                                                                   | proportional |
| Lead label                         | 13 / 20     | 500    | 0        | `ink-secondary`                                                         | —            |
| Lead delta                         | 14 / 20     | 500    | 0        | `positive` / `negative` / `ink-secondary`                               | tabular      |
| Lead facts (target, previous)      | 13 / 20     | 400    | 0        | `ink-muted`; the value 500 `ink`; position-vs-target in semantic colour | tabular      |
| Supporting KPI value               | 20 / 28     | 600    | −0.02em  | `ink`                                                                   | proportional |
| Supporting KPI label               | 13 / 20     | 500    | 0        | `ink-secondary`                                                         | —            |
| Supporting KPI delta / target note | 12 / 16     | 500    | 0        | semantic when material, else `ink-secondary`; target note `ink-muted`   | tabular      |
| Section title (chart, rail, table) | 16 / 24     | 600    | −0.01em  | `ink`                                                                   | —            |
| Section subtitle                   | 12 / 16     | 400    | 0        | `ink-muted`                                                             | tabular      |
| Chart value (end label, tooltip)   | 13 / 20     | 500    | 0        | `ink`                                                                   | tabular      |
| Axis tick / x label                | 11 / 16     | 400    | +0.01em  | `ink-faint`                                                             | tabular      |
| Table header                       | 12 / 16     | 500    | 0        | `ink-muted`; active sort `ink`                                          | —            |
| Table entity                       | 13 / 20     | 500    | 0        | `ink`; paused `ink-muted`                                               | —            |
| Table meta line                    | 12 / 16     | 400    | 0        | `ink-muted`                                                             | tabular      |
| Table numeric, primary             | 13 / 20     | 500    | 0        | `ink`                                                                   | tabular      |
| Table numeric, secondary           | 13 / 20     | 400    | 0        | `ink-secondary`                                                         | tabular      |
| Change value (table, strip, rail)  | 12 / 16     | 500    | 0        | semantic when material, else `ink-secondary`; null `ink-faint` "—"      | tabular      |
| Rank numeral                       | 12 / 16     | 400    | 0        | `ink-faint`                                                             | tabular      |
| Nav item                           | 13 / 20     | 500    | 0        | `ink-secondary`; active `ink`                                           | —            |
| Nav group label                    | 12 / 16     | 500    | 0        | `ink-faint`                                                             | —            |
| Wordmark                           | 14 / 20     | 600    | −0.01em  | `ink`                                                                   | —            |
| Metadata / footer                  | 12 / 16     | 400    | 0        | `ink-muted`                                                             | tabular      |
| Caption / tooltip date             | 12 / 16     | 400    | 0        | `ink-muted`                                                             | —            |
| Body                               | 13 / 20     | 400    | 0        | `ink-secondary`                                                         | —            |

Effective visual levels on the Overview: 36 → 22 → 20 → 16 → 13 → 12 → 11, with weight and colour reinforcing rather than replacing size. The baseline uses 11–14 and 26.

Rules:

- A numeral never sits at the same weight as its label. Label 500 / value 600, or label 400 / value 500.
- Sentence case everywhere, including table headers and nav group labels. No trailing colons.
- Body prose stays under 72 characters per line (rail subtitles, empty states, notes).
- One metric, one name. The strip label, the chart title and the table header use the same term ("Purchases", "Cost per purchase"). Abbreviations are allowed only for ROAS and CTR, which the audience uses daily, and they are expanded once per page in the metadata line beneath the table ("ROAS return on ad spend · CTR click-through rate").

---

## 5. Colour and surface rules

Tokens are unchanged except where noted. The change is in **where** they are used.

### Surfaces

| Region                            | Surface                                                   | Border                     | Shadow      |
| --------------------------------- | --------------------------------------------------------- | -------------------------- | ----------- |
| Page                              | `surface` (white)                                         | none                       | none        |
| Sidebar rail, mobile sheet        | `canvas` (#f5f6f8)                                        | 1px `border` on the right  | none        |
| Instrument (Overview)             | `surface`                                                 | 1px `border`, 8px radius   | none        |
| Table frame                       | `surface`                                                 | 1px `border`, 8px radius   | none        |
| Table header row, totals row      | `surface-subtle`                                          | 1px `border` below / above | none        |
| Rail sections, page header, lists | open (no fill, no border); hairline `border` between rows | —                          | none        |
| Tooltip, menus                    | `surface`                                                 | 1px `border`, 6px radius   | `shadow-md` |
| Empty state                       | `surface-subtle`, dashed `border-strong`                  | —                          | none        |

`shadow-xs` is retired from static surfaces. Hierarchy is surface step plus hairline (Carbon). Consecutive regions alternate: outlined → open → outlined; never two tinted or two outlined regions touching.

### Budgets (per desktop viewport, Overview)

- Outlined containers: **≤ 2** (instrument, campaigns table).
- Hairlines outside table and list rows: **≤ 4** (instrument: under the lead row and under the strip; rail: none; footer: one).
- Blue elements: **≤ 4** (active nav rule, selected-metric rule, chart series with its end marker, one link or primary action). Focus rings excepted.
- Coloured change values: only those at or above the materiality threshold (5 %). The lead delta and every position-vs-target statement are always coloured.

### Semantic colour

- `positive` / `negative` are text colours only. They colour: material changes (direction × desirability), position against target ("£1.12 under target" positive; "0.79x short" negative). They never colour a value itself, a heading, a fill, a border or an icon.
- Spend change has no desirability (`higherIsBetter: null`) and is always `ink-secondary`.
- `warning` stays reserved for APP 05 watch states.
- Status dots: `positive` for active, `ink-faint` for paused, `border-strong` for archived (as the current `StatusBadge` does, minus the badge).

### Data colour

- Current series: `chart-primary`. Previous series: `chart-muted`. Target line: `ink-muted` dashed. Gridlines: `chart-grid`; baseline `border`.
- Spend-by-campaign bars: `ink-secondary` fill on a `surface-active` track; the largest campaign's bar in `ink`. Not blue: the bars show proportion, not selection, and the chart beside them already owns the blue.
- Sparklines (creatives ledger only): 1.5px `chart-primary` for the current period, `chart-muted` for the previous, end dot 2.5px with a white ring.
- Creative placeholder tones: unchanged (§8a of DESIGN.md).

---

## 6. Overview composition

Structure at 1440 (12 columns; the rail starts at column 9).

```
┌ page header (12) ──────────────────────────────────────────────────────────────────┐
│ Overview                                                   27 Sep – 3 Oct 2026     │
│ Luxe Skin Co. · Meta Ads · act_283117904455          vs 20 – 26 Sep  [Today|…|30D] │
└────────────────────────────────────────────────────────────────────────────────────┘
                                                                                24px
┌ instrument (8) ───────────────────────────────┐  ┌ rail (4) ─────────────────────┐
│ Return on ad spend                 Target 3.5x│  │ Spend by campaign             │
│ 2.71x  +3.4%                       0.79x short│  │ £7,420 · 8 delivering         │
│ from 2.62x · previous 7 days                  │  │ Autumn Reset Sale  £1,805 24% │
│ ──────────────────────────────────────────────│  │ ████████████░░░░░░            │
│ Spend     Purchases  Revenue  Cost per  CTR   │  │ Retinol Renewal    £1,784 24% │
│ £7,420    276        £20.1k   purchase  1.51% │  │ ████████████░░░░░░            │
│ +6.3%     +6.2%      +10.0%   £26.88    −3.9% │  │ … (6 rows + "2 other")        │
│ ═════                         £1.12 under     │  │                               │
│ ──────────────────────────────────────────────│  │                          32px │
│ Daily spend            — 27 Sep–3 Oct  — prev │  │ Largest changes               │
│ £1,500 ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈│  │ vs 20 – 26 Sep                │
│        ╱‾‾╲      ╱‾‾‾╲        ╱‾‾ ● £1,094    │  │ Cart Abandoners 7D   57  +31  │
│ £750  ╱    ‾‾‾‾‾‾      ‾‾‾‾‾‾‾                │  │ Purchases                     │
│       · · · · previous · · · · · ·            │  │ Vitamin C Brightening 24 −14  │
│ £0 ───────────────────────────────────────────│  │ Purchases                     │
│   Sun 27  Mon 28  Tue 29  Wed 30  Thu 1  Fri 2│  │ Autumn Reset Sale £1,805 +£431│
└───────────────────────────────────────────────┘  │ Spend  … (6 rows)             │
                                                   └───────────────────────────────┘
                                                                                32px
┌ Campaigns (12) ────────────────────────────────────────────────────────────────────┐
│ Campaigns                                                     All 9 campaigns →   │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ Campaign            Spend   Change  Purchases Change  Cost per purchase ROAS CTR│ │
│ │ ● Autumn Reset Sale £1,805  +31.4%  13        −43.5%  £138.83  0.47x 1.04%   │ │
│ │ … top 6 by spend, totals row                                                 │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────┘
                                                                                32px
─────────────────────────────────────────────────────────────────────────────────────
Luxe Skin Co. – Meta · 9 campaigns (8 active) · 13 ad sets · 27 ads · 26 creatives ·
daily metrics 5 Aug – 3 Oct 2026 (60 days)
```

### Regions, in reading order

**Page header (12 columns, open).** Title "Overview" 22px. Context line beneath: client name (500), platform, account id. Right: period line on two rows ("27 Sep – 3 Oct 2026" 13px `ink-secondary` 500; "vs 20 – 26 Sep" 12px `ink-muted`) and the preset control. The filter row sits above everything it scopes and nowhere else. Below 768 the header stacks.

**Instrument (8 columns, outlined).** Padding 20px horizontal, 16px vertical. Three rows divided by two hairlines:

1. _Lead row_ (min height 88px). Left: lead label, lead numeral with the delta on the same baseline (12px gap), a facts line beneath ("from 2.62x · previous 7 days"). Right, bottom-aligned to the numeral's baseline: the target block, two lines right-aligned ("Target 3.5x" 13px muted with the value 500; "0.79x short" 13px `negative`).
2. _Metric strip_ (height 76px). Five cells in a 5-column sub-grid with 16px gaps. Each cell: label, value, delta line. The charted metric's cell carries a 2px `accent` rule along the strip's bottom edge, the full width of the cell, overlapping the hairline below so the rule reads as the chart's handle.
3. _Chart_ (height 280px plot + 20px x-axis band). Chart header row: section title "Daily spend" left; legend right. See §8.

**Rail (4 columns, open).** Top edge aligned to the instrument's top edge. Two sections, 32px apart:

- _Spend by campaign._ Title 16px, subtitle "£7,420 · 8 delivering campaigns". Rows (36px rhythm): name (13px `ink`, truncated) left; value (13px 500 tabular) and share (12px `ink-muted`) right; a 4px bar beneath the text on a `surface-active` track, width proportional to the largest. Six rows plus "2 other campaigns". No hairlines between rows; the bars give the rhythm.
- _Largest changes._ Title 16px, subtitle "vs 20 – 26 Sep". Six rows (40px, hairline between): campaign name 13px `ink` on line one, the measure ("Purchases", "Spend") 12px `ink-muted` on line two; right-aligned: current value 13px 500 and the absolute change 12px coloured if material ("+31", "−£207"). Rows are the three largest absolute changes in conversions and the three largest in spend among delivering campaigns. Ranking only; no thresholds, no verdicts, no prose. This is the computed-facts precursor of the APP 05 Insights page and is titled as a ranking, never as "insights".

**Campaigns (12 columns, outlined table).** Section title "Campaigns" 16px with a right-aligned link "All 9 campaigns →" (13px `accent`, the page's one link). Table: top six campaigns by spend, columns Campaign · Spend · Change · Purchases · Change · Cost per purchase · ROAS · CTR, totals row for the visible six. Rules in §10.

**Footer line (12 columns, open, one hairline above).** 12px `ink-muted` metadata: account name and id, structure counts, data coverage. This replaces the Account card.

### What is gone

Six equal tiles with icons and pills; the second chart; the Account card; the "Daily trend" card header with an icon; the "vs previous 7 days" line repeated six times (it appears once, in the header, and once in the lead facts); the selected-period band.

### Below 1280

The rail stacks beneath the instrument as two side-by-side sections (6 + 6). Below 1024 they stack. Reading order is unchanged: lead → strip → chart → concentration → changes → table → footer, and the DOM order matches it at every width.

---

## 7. KPI hierarchy

Six metrics, three tiers. Not all six deserve equal weight.

| Tier       | Metric(s)                                                                                     | Treatment                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lead       | The target-bearing efficiency metric: ROAS when `targetRoas` is set, else cost per conversion | 36px numeral, 14px delta, previous value in words, target and position against target. The only 36px element on the page.                              |
| Volume     | Spend, conversions (purchases / leads / trials)                                               | First two strip cells. 20px value, delta. Spend's delta is always neutral; conversions' delta is coloured when material.                               |
| Supporting | Revenue (when tracked), the other efficiency metric (cost per conversion or ROAS), CTR        | Remaining strip cells, same anatomy. The efficiency cell carries its target note ("£1.12 under") in place of a second delta line when a target exists. |

Per client type (from `primaryMetricKeys` and the target fields):

| Client           | Lead                       | Strip, in order                                                    |
| ---------------- | -------------------------- | ------------------------------------------------------------------ |
| Ecommerce (Luxe) | Return on ad spend vs 3.5x | Spend · Purchases · Revenue · Cost per purchase (target £28) · CTR |
| Lead gen (Peak)  | Cost per lead vs £18       | Spend · Leads · CTR · CPC · CPM                                    |
| SaaS (Arc Cloud) | Cost per trial vs $85      | Spend · Trials · CTR · CPC · CPM                                   |

Comparison and target:

- **Current vs previous** is shown twice at most: as a signed percentage beside the value (the delta) and, for the lead only, as the previous absolute value in words ("from 2.62x"). The chart shows the previous period as a series. Nothing else repeats "vs previous 7 days".
- **Targets are integrated**, not secondary: the lead's target sits on the lead row; the supporting efficiency metric's target sits in its cell; the chart draws a target line whenever the charted metric has one. Position against target is always stated in the client's units ("£1.12 under target", "0.79x short"), never only as a percentage.
- **Materiality.** Changes under 5 % (absolute) render in `ink-secondary` in the strip, the rail and tables. The lead delta is always coloured because the reader needs its direction at a glance. Null comparisons render "—" in `ink-faint` with screen-reader text.

The strip is the chart's control row. In APP 01.6 the cells are static and the charted metric is spend; in APP 02 each cell becomes a button (`aria-pressed`) and selecting one morphs the chart (DESIGN.md §20 chart rules). Static cells are not rendered as buttons; a control that does nothing is a lie.

Sparklines are removed from the strip. The chart carries the trend; six 88×26 sparklines beside six numerals are noise at the moment the reader is trying to find one number.

---

## 8. Chart grammar

The chart is the product's centre of gravity and is drawn to be read, not admired. One axis. One series charted at a time. The static parts below ship in APP 01.6 as SVG; the interactive parts are the contract the APP 02 charting layer is styled to.

| Element                 | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plot                    | 280px tall at ≥ 1024 (240 at 768–1023, 200 below), full instrument width minus a 48px tick column. X-axis band 20px beneath.                                                                                                                                                                                                                                                                                                                                                        |
| Current-period series   | 2px `chart-primary`, round joins and caps. Area wash at 6 % opacity of the series colour, current period only. End marker: 8px dot (r = 4) with a 2px `surface` ring.                                                                                                                                                                                                                                                                                                               |
| Previous-period series  | 1.5px `chart-muted`, solid, no wash, no markers, drawn beneath the current series. Aligned by day index: day 1 of the previous period sits under day 1 of the current.                                                                                                                                                                                                                                                                                                              |
| Target / reference line | 1px `ink-muted`, dashed 4/4, horizontal at the target value, with an 11px label on the line at the right edge ("Target £28"). Present only when the charted metric has a target. Dashing is reserved for this line.                                                                                                                                                                                                                                                                 |
| Gridlines               | Three: max, half, zero. Max and half 1px `chart-grid`; the zero line 1px `border` (one step darker) so the baseline reads as the floor. Never dashed, never vertical.                                                                                                                                                                                                                                                                                                               |
| Y ticks                 | 11px `ink-faint`, tabular, +0.01em, right-aligned in the 48px column, nice numbers (1 / 2 / 2.5 / 5 × 10ⁿ), thousands separated, compact above 10k.                                                                                                                                                                                                                                                                                                                                 |
| X labels                | 11px `ink-faint`. One per day up to 14 points ("Sun 27"), every fifth day at 30, first and last always. Weekday included because paid-social patterns are weekly.                                                                                                                                                                                                                                                                                                                   |
| Direct labels           | One: the current series' last value, 13px 500 `ink` tabular, placed to the right of the end marker (above it if there is no room). Never a number on every point.                                                                                                                                                                                                                                                                                                                   |
| Legend                  | In the chart header, right-aligned, 12px `ink-muted`: a 12×2 blue stroke + "27 Sep – 3 Oct", a 12×2 grey stroke + "20 – 26 Sep", a dashed 12×1 stroke + "Target £28" when present. Keys are strokes, never boxes.                                                                                                                                                                                                                                                                   |
| Chart title             | 16px 600, "Daily spend" / "Daily purchases" / "Daily cost per purchase". Left of the legend.                                                                                                                                                                                                                                                                                                                                                                                        |
| Hover target (APP 02)   | A vertical crosshair, 1px `border-strong`, snaps to the nearest day; the hit area is the full column width and plot height. Both series get a 6px marker at the hovered day. Keyboard: the plot is focusable, arrow keys move the day.                                                                                                                                                                                                                                              |
| Tooltip (APP 02)        | Surface level 2, 6px radius, 8px padding, max 240px, positioned to the side of the crosshair away from the nearest edge. Rows: date line 12px `ink-muted` ("Tue 29 Sep"); current row: blue stroke key, "This period", value 13px 500 `ink` right-aligned; previous row: grey key, "22 Sep", value 13px `ink-secondary`; change row: "+12.4 % vs same day" 12px coloured if material. Values lead, labels follow. Tooltips enhance; the values are also in the strip and the table. |
| Selected metric state   | The strip cell's 2px `accent` bottom rule; the chart title and the series change together. Unselected cells have no rule. Hover on a selectable cell (APP 02): `surface-hover` fill with 6px radius inside the cell.                                                                                                                                                                                                                                                                |
| Annotations             | APP 01.6: the end label only. APP 05: finding markers as 8px `ink` dots with a white ring on the series at the day a rule fires, with the finding in the tooltip. No callout boxes on the plot.                                                                                                                                                                                                                                                                                     |
| One-day presets         | "Today" and "Yesterday" chart the trailing 14 days with the selected day's column shaded `accent-soft` at 40 %, because a one-point line says nothing. The only case where a band appears.                                                                                                                                                                                                                                                                                          |
| Loading / refetch       | The previous render holds at 70 % opacity until new data arrives; no skeleton, no flash.                                                                                                                                                                                                                                                                                                                                                                                            |
| Motion                  | As DESIGN.md §20 "Charts (APP 02 direction)": morph on client or period change, one 220ms reveal on first paint, no replayed entrances, previous series stays secondary.                                                                                                                                                                                                                                                                                                            |

Rules:

- Text never wears the series colour. The end label, ticks and legend text are ink tokens; the stroke beside them carries identity.
- Two measures never share a plot (no dual axes). A second measure is a second selection, not a second line.
- Every chart has a table twin: the strip and the campaigns table hold the period totals, and the tooltip's daily values are exposed to assistive technology through a visually hidden daily table (APP 02).

---

## 9. Sidebar system

The rail is the one element on every screen, so it is where the product's authorship shows first. It keeps the navigation architecture (D-014 groups, D-013 region model) and replaces every default idiom.

| Element             | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rail                | 240px, `canvas` fill, 1px `border` on the right, 12px padding. No shadow.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Brand treatment     | A proprietary 20×20 mark drawn from the chart grammar: a 2px `ink` baseline and a 2px `accent` stroke rising left to right that ends in a 4px dot. No container square. Wordmark "Ad Analyst" 14px 600 −0.01em `ink` beside it; agency name "Northstar Media" 12px `ink-muted` beneath the wordmark. Block height 40px, 4px bottom margin. The mark's final geometry is drawn in the implementation pass; this spec fixes its material (one ink line, one blue line, one dot). |
| Agency / client     | The agency is the workspace: small, muted, part of the brand block. The client is the operating context: the switcher directly beneath, visibly the second most important thing in the rail.                                                                                                                                                                                                                                                                                   |
| Client switcher     | A quiet 40px row, no border at rest. 24px initials mark (`ink` fill, white 11px 600 initials, 6px radius; never blue), client name 14px 500 `ink`, "Ecommerce · GBP" 12px `ink-muted`, chevrons icon 14px `ink-faint` visible at rest. Hover `surface-active`; open `surface` with 1px `border`. Menu: surface level 2, agency name as a 12px sentence-case group label, radio items with the initials mark, check indicator in `ink`.                                         |
| Group labels        | "Analyse", "Workspace": 12px 500 `ink-faint`, sentence case, 24px above (16px for the first), 6px below, 10px left inset to align with item text.                                                                                                                                                                                                                                                                                                                              |
| Nav density         | Items 32px, 2px gap, 10px horizontal padding, 10px icon-to-label gap. Seven items occupy 262px; the rail breathes.                                                                                                                                                                                                                                                                                                                                                             |
| Icons               | lucide 16px, stroke 1.5 at rest in `ink-muted`; active stroke 2 in `ink`. Icons are never blue.                                                                                                                                                                                                                                                                                                                                                                                |
| Active state        | `surface` (white) fill, 6px radius, `ink` text, and a 2px `accent` rule on the item's left edge (inset 0, 8px tall margins so it reads as a mark, not a border). Not the pale-blue pill. `aria-current="page"`.                                                                                                                                                                                                                                                                |
| Hover / focus       | Hover `surface-active`. Focus ring per DESIGN.md §12 (2px `accent`, offset 2). Pressed one step darker.                                                                                                                                                                                                                                                                                                                                                                        |
| Footer / data state | Hairline above, 12px padding. Line one: 6px `positive` dot, "Meta Ads · demo dataset" 12px 500 `ink-secondary`. Line two: "60 days to 3 Oct" 12px `ink-muted`. Nothing else. When imports exist this line becomes the connection state ("Synced 09:14").                                                                                                                                                                                                                       |
| Mobile              | Unchanged structure: 48px top bar with the mark, compact switcher and menu button; the sheet is the rail at 280px on `canvas`.                                                                                                                                                                                                                                                                                                                                                 |

Blue in the rail: the mark's stroke and the active rule. Two instances, both meaning "current".

---

## 10. Campaigns table system

The dense table concept stays: one row per campaign, 40px, every column visible, horizontal scroll inside the frame rather than hidden columns. The rules change what the rows say.

| Aspect            | Specification                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar           | Open (no border), 12px above the frame: search input 240px with a 14px `ink-faint` icon, status segmented control (All · Active · Paused), right-aligned count "9 campaigns" 13px `ink-muted` tabular. Filters scope the table and the totals.                                                                                                           |
| Table frame       | 1px `border`, 8px radius, `surface`, no shadow, `overflow-x: auto`. Header row 36px on `surface-subtle` with a hairline beneath. Totals row on `surface-subtle` with a hairline above.                                                                                                                                                                   |
| Columns           | Campaign (min 240, max 360) · Ad sets · Spend · Change · Purchases · Change · Cost per purchase · ROAS · CTR. Change columns pair with the metric to their left: 8px gutter inside the pair, 24px before the next metric. The pair header reads "Change" with `title="vs 20 – 26 Sep"`. Expansions of ROAS and CTR in the metadata line under the frame. |
| Entity hierarchy  | Name 13px 500 `ink`, one line, truncated with `title`. Meta line 12px `ink-muted`: "Sales · 4 ads". A 6px status dot precedes the name (positive = active, `ink-faint` = paused) with visually hidden text. Paused rows render the name in `ink-muted`.                                                                                                  |
| Status            | No status column, no badge. The dot plus the filter chips carry status. Sorting by status is dropped; filtering replaces it.                                                                                                                                                                                                                             |
| Numeric hierarchy | Spend and purchases 13px 500 `ink`. Cost per purchase, ROAS, CTR 13px 400 `ink-secondary`. Ad sets 13px 400 `ink-muted`. All tabular, right-aligned. Nulls "—" `ink-faint`.                                                                                                                                                                              |
| Change values     | 12px 500 tabular. Signed with a true minus; no arrow glyphs (the sign carries direction, the colour carries desirability). Spend change is always neutral `ink-secondary`. Purchases change coloured when ≥ 5 %. Null "—".                                                                                                                               |
| Sorting           | Header buttons with `aria-sort`. Active column: label `ink`, a 12px arrow in `accent`. Inactive columns show no arrow until hover. Default sort spend descending. Sorted column cells carry no tint.                                                                                                                                                     |
| Row hover         | `surface-hover` fill across the row, `transition-colors` micro. Nothing else moves. Rows are not links in APP 01.6.                                                                                                                                                                                                                                      |
| Selected state    | Reserved for the drilldown release: `accent-soft` at 40 % plus a 2px `accent` rule on the row's left edge, `aria-selected`. Keyboard: arrow keys move selection, Enter opens.                                                                                                                                                                            |
| Column spacing    | 12px cell padding; first and last cells 16px. Numeric columns min 72px. Header labels never wrap.                                                                                                                                                                                                                                                        |
| Totals row        | "Total · 9 campaigns" 13px `ink-secondary`; numerals 500 `ink`; change cells empty.                                                                                                                                                                                                                                                                      |
| Empty / filtered  | "No campaigns match the current filters." 13px `ink-muted`, 64px row. Never a dashed box inside the frame.                                                                                                                                                                                                                                               |
| Metadata line     | 12px `ink-muted`, 8px below the frame: "Compared with 20 – 26 Sep · ROAS return on ad spend · CTR click-through rate". Replaces the roadmap note.                                                                                                                                                                                                        |
| Mobile            | The frame scrolls horizontally; the campaign column is sticky at 200px with a 1px `border` on its right edge so numbers scroll beneath it.                                                                                                                                                                                                               |

Page header for Campaigns: title "Campaigns" 22px; context "Luxe Skin Co. · 9 campaigns · 8 active"; period line and preset control right.

---

## 11. Creatives system

Creative performance is a ranking problem: which creative is earning its spend and which is not. The page is a **ledger**, not a catalogue.

| Aspect             | Specification                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout rhythm      | Toolbar (type filter · sort · count) → one full-width ledger, 72px rows, hairline between rows, no outer frame on desktop (a frame appears only below 768 where the row scrolls). Rank numeral 12px `ink-faint` in a 32px first column, so the order is visible after any sort.                                                                                                                                     |
| Artwork prominence | 56×70 (4:5 frame) on the left of every row, letterboxed placeholder or imported image, 4px radius, 1px `border` at 50 %. Large enough to recognise a creative, small enough that the row stays a row. No full-bleed cards. The thumbnail is the identity, the title is the name.                                                                                                                                    |
| Title hierarchy    | Title 13px 500 `ink`, up to two lines, clamped. Beneath it the meta line.                                                                                                                                                                                                                                                                                                                                           |
| Metadata           | 12px `ink-muted`: "Video · 2 ads · 1 campaign". The aspect ratio chip is dropped (nobody acts on it); the type word carries the format.                                                                                                                                                                                                                                                                             |
| Metric hierarchy   | Columns right of the identity block: Spend (13px 500 `ink`) with its change beneath (12px neutral); Purchases (13px 500); Cost per purchase (13px 500 `ink`) with position against target beneath ("£8 over" 12px coloured); ROAS (or CPC) 13px `ink-secondary`; CTR 13px `ink-secondary` with a 72×20 sparkline to its right and its change beneath. Four numbers lead (spend, purchases, cost, CTR); two support. |
| Performance state  | Expressed as text, not badges: cost per purchase against the client's target, coloured by desirability, under the cost value. Creatives with no delivery in the period show "No delivery" in `ink-muted` across the metric columns and sort to the bottom. Fatigue and winner signals (APP 05) will appear as a 12px `warning` or `positive` word in the meta line, never as a coloured card.                       |
| Hover behaviour    | Row `surface-hover`; the artwork does not scale; a 14px `ink-muted` "open" affordance appears at the row's right edge when a detail view exists (later). Nothing lifts.                                                                                                                                                                                                                                             |
| Sorting            | Native `select` styled as an input: Spend · Purchases · Cost per purchase (lowest first) · CTR · ROAS. Changing the sort re-numbers the rank column.                                                                                                                                                                                                                                                                |
| Density            | 26 rows ≈ 1,900px; a 1440×900 viewport shows nine creatives above the fold with their numbers, versus six to eight partial cards today.                                                                                                                                                                                                                                                                             |
| Mobile             | Rows keep artwork, title, meta, spend and cost per purchase; purchases, ROAS and CTR scroll horizontally inside the row's numeric region. Rank numeral hidden below 640.                                                                                                                                                                                                                                            |

Page header for Creatives: title "Creatives" 22px; context "Luxe Skin Co. · 26 creatives across 9 campaigns"; period and preset right.

Deferred, deliberately: a gallery density toggle (larger artwork, fewer numbers) once real imagery is imported; it is a view, not the default.

---

## 12. Motion usage

DESIGN.md §20 stands in full: four durations (120 / 160 / 220 / 300ms), three curves, transform and opacity first, named properties, mandatory reduced-motion collapse, no animation library. V2 adds applications, not tokens.

| Where                         | Behaviour                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav active rule               | No transition. The current page is a fact, not a state change.                                                                                       |
| Nav and ledger hover          | `transition-colors` micro on the fill only.                                                                                                          |
| Strip cell selection (APP 02) | The 2px rule moves to the selected cell with `transform` over the standard duration; the chart morphs in the same transition.                        |
| Chart hover (APP 02)          | Crosshair and markers move instantly; the tooltip fades in micro and does not animate position.                                                      |
| Chart data change (APP 02)    | Series morph, axes rescale, standard duration, ease-standard; previous series stays muted throughout. First paint: one 220ms reveal, never replayed. |
| Lead numeral (APP 02)         | Tweens over the standard duration on client or period change; the delta and target line crossfade (micro). Instant under reduced motion.             |
| Table sort                    | Instant reorder in APP 01.6. APP 02 may crossfade cell values (micro); rows never slide.                                                             |
| Page enter                    | `animate-page-in` on route change only, as today.                                                                                                    |

Nothing in V2 adds a scale, a spring, a shimmer, a stagger or a hover lift.

---

## 13. Anti-patterns

What V2 must not produce. The first group repeats the failures of APP 01.5; the second group is the opposite extreme; the third is specific to this system.

**From APP 01.5, never again**

- Large unstructured white areas; whitespace that does not separate anything.
- Text below 11px, or 11–12px carrying primary information.
- Six (or five) equal metric cells with no lead.
- A flat metric band with hairline-divided cells and no reading order.
- A chart with no annotation, no target line, no previous period, no end value, introduced by a 13px label.
- Prose blocks titled "summary" standing in for computed facts.
- Admin-kit sidebar styling: ink square with a letter, bordered combobox, uppercase group labels, pale-blue active pill.
- A page whose largest text is a generic word.
- Hairlines around every region (41 on one page).
- A page that reads as a wireframe: equal boxes, equal greys, nothing leading.

**The opposite extreme, also banned**

- A card per thing, cards inside cards, shadows on static surfaces.
- Radii above 8px on containers, pills as a default control shape.
- Gradients, glass, blur, "AI" colours, a second accent.
- Bento mosaics or hero cards sized for effect rather than content.
- Novelty motion: springs, staggers, counters that run on every render, hover lifts.
- Decorative icons on every card header or metric cell.

**System-specific**

- Blue used for anything other than "current" and "the charted series". Blue bars, blue numerals, blue icons at rest.
- Green or red as a fill, a border, a dot on a structural entity, or on a change under the materiality threshold.
- A sparkline beside a number that a chart on the same screen already explains.
- Tracked uppercase labels anywhere.
- Two consecutive outlined regions, or two consecutive tinted regions.
- A metric named differently in the strip, the chart and the table.
- Release-schedule or roadmap copy rendered in the UI.
- A control that does nothing (static strip cells rendered as buttons).
- Dashed lines used for anything but the target line.
- A number on every data point; a legend with one swatch.

---

## 14. Component examples, described structurally

Anatomy, sizes and states for the pieces the implementation pass builds. Names are proposals for `src/components/ui/` and `src/features/`.

### `PageHeader`

```
<header>                                  margin-bottom 24
  <div>                                   left, min-width 0
    <h1>Overview</h1>                     22/28 600 −0.02em ink
    <p>Luxe Skin Co. · Meta Ads · act_283117904455</p>   13/20; client 500 ink-secondary; rest ink-muted
  </div>
  <div>                                   right, items-end, gap 12
    <p>27 Sep – 3 Oct 2026<br/>vs 20 – 26 Sep</p>        13/20 500 ink-secondary · 12/16 ink-muted
    <DatePresetControl/>                  32px segmented control (unchanged)
  </div>
</header>
```

Below 768: stacks, period line above the control.

### `Instrument` (feature: `features/overview/instrument.tsx`)

```
<section aria-labelledby="perf">          outlined: border, radius 8, surface
  <h2 id="perf" class="sr-only">Performance</h2>
  <LeadReading/>                          padding 20/16, min-height 88
  <hr/>                                   1px border
  <MetricStrip/>                          padding 20/12, height 76
  <hr/>                                   1px border (the selected cell's rule overlaps it)
  <TrendChart/>                           padding 20/16/20, header 24 + plot 280 + axis 20
</section>
```

### `LeadReading`

```
<div class="flex justify-between items-end">
  <div>
    <p>Return on ad spend</p>             13/20 500 ink-secondary
    <p>
      <span>2.71x</span>                  36/40 600 −0.03em ink, proportional
      <Delta>+3.4%</Delta>                14/20 500 positive, 12px gap, baseline-aligned
    </p>
    <p>from 2.62x · previous 7 days</p>  13/20 ink-muted; "2.62x" 500 ink
  </div>
  <dl class="text-right">
    <dt>Target</dt> <dd>3.5x</dd>         13/20 ink-muted; value 500 ink
    <dd>0.79x short</dd>                  13/20 500 negative
  </dl>
</div>
```

States: no target (lead gen without CPA target is impossible by the data model; every client has `targetCpa`) → the `dl` is omitted. No comparison → delta "—" `ink-faint`, facts line "no previous period". Below 640: numeral 30/36, the target block moves under the facts line.

### `MetricStrip` and `MetricCell`

```
<ul class="grid grid-cols-5 gap-4">       <ol> when the order is meaningful (it is)
  <li data-selected>                      selected cell: 2px accent rule, bottom edge, full cell width
    <p>Spend</p>                          13/20 500 ink-secondary
    <p>£7,420</p>                         20/28 600 −0.02em ink, proportional, nowrap
    <p><Delta>+6.3%</Delta></p>           12/16 500; spend always ink-secondary
  </li>
  <li>
    <p>Cost per purchase</p>
    <p>£26.88</p>
    <p><Delta>+0.2%</Delta> · <span>£1.12 under</span></p>   delta neutral (< 5 %); target note positive
  </li>
</ul>
```

States: static in APP 01.6 (no hover). APP 02: `<button aria-pressed>` per cell, hover `surface-hover`, focus ring, selected rule animates. 768–1023: five across if ≥ 640px inner width, else 3 + 2. < 640: two columns, the fifth cell full width.

### `TrendChart` (replaces `LineChart`)

```
<figure>
  <div class="flex justify-between">      chart header, height 24, margin-bottom 12
    <h3>Daily spend</h3>                  16/24 600 −0.01em ink
    <ul aria-label="Legend">              12/16 ink-muted, gap 16; stroke keys 12×2 (dashed 12×1 for target)
  </div>
  <div class="grid grid-cols-[48px_1fr]">
    <div>ticks</div>                      11/16 ink-faint tabular, right-aligned, +0.01em
    <svg viewBox preserveAspectRatio="none" height 280>
      gridlines (max, half: chart-grid; zero: border)
      target line (dashed ink-muted) + label
      previous path (1.5px chart-muted)
      current wash (6 %) + current path (2px chart-primary)
      end marker (r 4, 2px surface ring) + end label (13/20 500 ink)
    </svg>
  </div>
  <div class="pl-12 flex justify-between">x labels</div>   11/16 ink-faint, 20px band
  <figcaption class="sr-only">Daily spend, 27 Sep – 3 Oct 2026, compared with 20 – 26 Sep.</figcaption>
</figure>
```

Props: `current[]`, `previous[]`, `target?`, `formatValue`, `title`, `periodLabels`. The 1-day preset variant takes `trailing[]` and `highlightIndex`.

### `RailSection`

```
<section>
  <h2>Spend by campaign</h2>              16/24 600 −0.01em ink
  <p>£7,420 · 8 delivering campaigns</p>  12/16 ink-muted, margin-bottom 12
  <ol>…rows…</ol>
</section>
```

`SpendConcentrationRow`: 36px rhythm; text row (name 13 `ink` truncate · value 13 500 tabular · share 12 `ink-muted`) then a 4px bar (`ink-secondary`; first row `ink`) on a `surface-active` track, 8px below the text, 12px before the next row.

`LargestChangeRow`: 40px, hairline between; two text lines left (name 13 `ink`, measure 12 `ink-muted`); right: value 13 500 tabular, change 12 500 coloured if material, absolute units ("+31", "−£207").

### `DataTable` additions (`Table` family)

- `Th` loses `uppercase tracking-wide text-2xs`; becomes 12/16 500 sentence case, 36px.
- `Td` gains `tone="primary" | "secondary" | "muted"` mapping to the numeric hierarchy.
- `ChangeCell` renders a `Delta` with `materiality` (default 0.05) and no arrow glyph.
- `EntityCell` renders status dot + name + meta line.
- Frame: `TableFrame` wraps the scroll container with border and radius; the header and footer tints live inside it.

### `CreativeRow`

```
<li class="grid grid-cols-[32px_56px_minmax(0,1fr)_repeat(5,auto)] items-center h-[72px] border-b">
  <span>1</span>                          12/16 ink-faint tabular
  <CreativeThumbnail size="row"/>         56×70, radius 4, border at 50 %
  <div>
    <h3>Autumn Reset – 25% Off – Video 15s</h3>   13/20 500 ink, line-clamp 2
    <p>Video · 1 ad · 1 campaign</p>      12/16 ink-muted
  </div>
  <Metric value="£981" sub={<Delta neutral>+36.1%</Delta>}/>
  <Metric value="8"/>
  <Metric value="£122.60" sub="£94.60 over target" tone="negative"/>
  <Metric value="0.50x" secondary/>
  <Metric value="1.11%" secondary spark={<Sparkline 72×20/>} sub={<Delta>−20.3%</Delta>}/>
</li>
```

States: no delivery → metric columns replaced by one `ink-muted` "No delivery in this period"; hover `surface-hover`; keyboard focus ring on the row when it becomes a link.

### `Sidebar` pieces

`BrandMark` (20px mark + wordmark + agency line), `ClientSwitcher` (quiet row; see §9), `NavGroupLabel` (12 sentence case `ink-faint`), `NavItem` (32px; active = white fill + 2px accent left rule + ink text + 2-stroke icon), `DataStatus` (hairline, dot, two lines).

### `Tooltip` (APP 02)

Surface level 2, 6px radius, 8px padding, 240px max, `role="tooltip"`, positioned by the chart layer; rows as in §8. Arrives with the charting library, styled to this spec.

---

## 15. What from APP 01 stays

- **Architecture and data:** read models in `features/analytics/queries.ts`, `getKpiReadings`, `getCampaignRows`, `getCreativeRows`, vocabulary from `domain/labels.ts`, formatting from `domain/format.ts`. One new pure ranking (largest changes by absolute units) is the only query addition.
- **Tokens:** every colour token; the radius scale; the motion tokens and keyframes; `tabular` utility. Type tokens change at three sizes (§4).
- **Shell:** 240px rail, grouped navigation (Analyse / Workspace), client switcher semantics (Radix radio menu, optimistic selection), mobile sheet, skip link, page template enter animation.
- **Controls:** segmented control with its sliding indicator, inputs, buttons, the date preset control, native `select` for sort.
- **Tables:** semantics (`caption`, `th scope`, `aria-sort`), sort and filter behaviour, totals row, horizontal scroll inside the frame, 40px rows, 13px cells, hairline row dividers.
- **Charts:** the single-axis rule, 2px lines, three gridlines, nice ticks, static SVG with `vector-effect: non-scaling-stroke` until APP 02.
- **Creative placeholders:** tone and motif system, letterboxing, the small-size rule (motif only). The large-size markers are unused by the ledger and stay for later views.
- **Delta semantics:** direction × desirability, true minus sign, screen-reader text; the component gains a materiality threshold and loses its arrow glyph and pill variant.
- **Empty states and the `Note` component**, minus every sentence about release schedules.
- **Accessibility baseline:** headings, labelled controls, focus rings, reduced motion.
- **DESIGN.md §20 Motion** in full, and §8a Creative placeholders.

---

## 16. What must change

| Area          | APP 01 baseline                                                    | V2                                                                                                      |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Overview lead | Six equal 26px tiles with icons, pills, sparklines                 | One 36px lead reading with target; five-cell strip as the chart's selector; one 280px chart             |
| Second chart  | Daily conversions at 110px under spend                             | Removed; conversions one selection away                                                                 |
| Rail          | Two cards (spend bars in blue, account counts)                     | Two open sections: spend concentration (ink bars), largest changes (ranked rows); counts to the footer  |
| Page surface  | Grey canvas, white cards with `shadow-xs`                          | White page, grey rail, two outlined regions, no shadows                                                 |
| Grid          | Per-section splits (1fr + 340px)                                   | 12 columns, 24px gutters, 8 + 4, rail from 1280                                                         |
| Type scale    | 11 / 12 / 13 / 14 and 26                                           | 11 / 12 / 13 / 14 / 16 / 20 / 22 / 30 / 36 with tracking tokens and a numeral register                  |
| Labels        | 11px uppercase tracked (nav groups, table headers, tile hints)     | 12–13px sentence case everywhere                                                                        |
| Page header   | 18px title, 12px description                                       | 22px title, 13px context with the client in 500, period on two lines                                    |
| Card headers  | Icon + 13px title + description                                    | 16px section titles, no icons, subtitle only when it adds a fact                                        |
| Sidebar       | Ink square mark, bordered switcher, uppercase groups, blue pill    | Line-and-dot mark, quiet switcher, sentence-case groups, white item with a 2px blue rule                |
| Campaigns     | "Δ" headers, status badge column, colour on every delta            | "Change" pairs, status dot, materiality threshold, full metric names, metadata line, sticky name column |
| Creatives     | 4-column card grid, 64px thumbnails, four-metric strip, CTR footer | Ranked ledger, 56×70 artwork, rank numeral, target position under cost, one sparkline per row           |
| Copy          | Roadmap notes on three pages; "vs previous 7 days" twelve times    | No roadmap copy; comparison stated once in the header and once in the lead facts                        |
| Blue          | Nav pill fill, bars, tile sparklines, chart, sort arrow            | Nav rule, strip rule, chart series, one link; four at most per viewport                                 |
| Decisions     | D-013 (fixed 340px rail from 1024), D-014 label style              | D-018 records V2; D-013 superseded; D-014 grouping kept, label style amended                            |

---

## 17. Implementation plan — APP 01.6 "Visual System V2"

**Phase:** APP 01.6, visual system only. No chart interaction, no date engine, no insight rules, no AI, no CSV, no auth (APP 02 / APP 05 unchanged). Starts from `3b56cdf`. Runs only after this document is approved and the decisions in §0 are confirmed or flipped.

**Order** (each step ends with checks green and a DEVLOG line; the owner reviews once at the end, not per step):

1. **Tokens and type** — `globals.css`: type sizes (§4), tracking tokens, retire `shadow-xs` usage, rail/page surface swap. `/impeccable typeset src/app` to verify roles on the shell and Overview.
2. **Shell** — `BrandMark`, quiet `ClientSwitcher`, `NavGroupLabel`, `NavItem` active rule, `DataStatus`; mobile top bar inherits. `/impeccable polish src/components/shell`.
3. **Page grid and header** — `PageGrid` / `Section` helpers (12 columns, spans), new `PageHeader` with the two-line period block. Apply to all seven routes so no page keeps the old header.
4. **Overview instrument** — `LeadReading`, `MetricStrip`, `MetricCell`, `TrendChart` (overlay, target line, end label, legend, one-day variant), `RailSection`, `SpendConcentrationRow`, `LargestChangeRow` (+ `rankLargestChanges` pure query), campaigns summary table, footer line. Remove `KpiTile`, `OverviewKpis`, `TrendFrame`, `AccountStructure`, `LineChart`, the tile sparkline usage. `/impeccable layout src/app/page.tsx`.
5. **Tables** — `Th` sentence case, `TableFrame`, `EntityCell`, `ChangeCell` with materiality, `Td` tones; Campaigns toolbar, column set, metadata line, sticky name column. `/impeccable clarify src/features/campaigns`.
6. **Creatives ledger** — `CreativeRow`, `CreativeLedger` (filter, sort, rank), thumbnail `row` size. Remove `CreativeCard` / `CreativeGrid`. `/impeccable layout src/app/creatives`.
7. **Copy and states** — delete roadmap sentences on Campaigns, Creatives, Insights, Ask; rewrite empty states in product voice. `/impeccable clarify` on the four pages.
8. **Distill and audit** — count containers, hairlines and blue instances per view against the §5 budgets; `/impeccable distill` on the Overview; `/impeccable audit` for a11y and responsive at 1440 / 1280 / 390 / 360; `impeccable detect` must stay at zero.
9. **Critique gate** — `/impeccable critique src/app` with sub-agents where the harness permits. Target ≥ 30 / 40 and a "specific to this product" verdict. Below that, fix and re-run once; still below, stop and report.
10. **Documents** — rewrite `DESIGN.md` from the shipped result (§1–§19 replaced, §20 kept; the budgets, the grid, the type roles and the blue rule become rules); DECISIONS D-018 (V2 adopted; D-013 superseded; D-014 label style amended; D-016 remains rejected); DEVLOG entry with checks, trade-offs and deferred items.
11. **Review gate** — checks green (`pnpm check`, `git diff --check`), dev server up, exact URLs for `/`, `/campaigns`, `/creatives` across the three clients, then stop for the owner's visual review before any commit (per the project's review habit; commit and push follow the brief's instruction at the time).

**Verification per step:** `pnpm format:check`, `lint`, `typecheck`, `test`, `build`; rendered-markup inspection for class counts (hairlines, outlined regions, blue tokens); no screenshots.

**Risks and mitigations**

- _The overlay chart with 7 points looks thin at 749px._ Mitigation: 2px line with markers only at the end, 6 % wash, weekday labels; verify at 7D and 30D before polishing. If the owner prefers the trailing window, swap to it in step 4 without touching the strip.
- _Materiality threshold hides a change the owner cares about._ It is one constant; set to 0 to colour everything.
- _The "Largest changes" ranking is read as an insight._ Title and subtitle name it as a ranking; no verdict words; rows show absolute units. APP 05 replaces it with findings.
- _Hero in red on a client who is under target every week._ It is the truth the product promises; the target is editable in Settings later.
- _Sticky first column plus horizontal scroll on mobile tables_ needs a browser pass; fall back to non-sticky if it jitters.

**Out of scope, stated:** chart hover, tooltip, metric selection, number tweens, series morph (APP 02); findings, fatigue, winner signals (APP 05); creative drilldown; gallery density; nav count badges; dark theme.

---

## Appendix A — What the references contributed, as rules

| Reference  | Rule adopted in V2                                                                                                                                                                                  | Not copied                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Vercel     | Fixed role scale with a real middle (16 / 20 / 22 / 36 at 600); tracking tightens with size; one filled action per view; 16px padding in dense grids, 20–24px standalone; three surface steps only. | Geist, mesh gradient, pill CTAs, stacked shadows, mono eyebrows. |
| Stripe     | Tabular figures as a system rule; 32px between dashboard sections; the previous value stated beside the current; navy ink.                                                                          | 15px body, weight-300 display, indigo, pill buttons.             |
| Coinbase   | One blue, scarce, with a counted budget; semantic colour as text only; rows as identity-left, numbers-right with hairlines (the creatives ledger, the rail rows); numbers in their own register.    | 24px radii, display at 400, mono numerals.                       |
| IBM Carbon | One 12-column grid every section obeys; hierarchy by surface step and hairline, not shadow; sentence-case labels; +0.01em on ticks; density as a design value.                                      | 0px corners, Plex, utility bar, charcoal footer.                 |
| Cal.com    | Surface alternation between consecutive regions; hover changes one property; 8px radius ceiling on containers; grey panels mean "summary", white-with-hairline means "the data".                    | Cal Sans, 96px rhythm, dark footer.                              |

Skill boundaries honoured: `premium`'s secondary purple, `clean`'s Roboto / Poppins and 8pt-only grid are not adopted; the dataviz skill's palette is not adopted (its mark specs, tooltip anatomy and "one axis" rule are).

## Appendix B — Method and declared substitutions

- **Impeccable `shape`.** The discovery interview was answered from the brief (precise, with explicit anti-goals); the critique's four owner questions resolve as: hierarchy (b) efficiency against target, with spend and volume as the first supporters; tone: calm surfaces with sharp type; scope: all three pages in one system, Overview first in implementation; the Campaigns table structure stays. No structured question was posed because the session is non-interactive and the brief asks for a document to review. Assumptions are listed in §0.
- **Impeccable `layout` and `typeset`.** The design assessments were run inline in this context, before the mechanical scans; `impeccable detect --scope layout src/` and `--scope type src/` both returned zero findings (the detector catches banned patterns, not absent hierarchy). Sub-agents were not spawned; the two assessments were sequenced rather than isolated, as the critique pass was.
- **Concept round.** `concept-seed` was not run: the direction is brief-pinned ("the analyst's instrument") and the world is established by PRODUCT.md's constraints and DESIGN.md's tokens; new-work's rule that a pinned direction beats the roll applies. The structural alternatives considered for the Overview and rejected: (i) chart-first with the strip as its caption (loses the single reading); (ii) hero spend with outcome beside it (answers "how much" before "how well"); (iii) summary sentence as the lead (prose scans worst). Chosen: the instrument.
- **Style skills.** `premium` applied as a precision check (explicit states for every component, a 12–36 scale, 4–32 spacing); `clean` as a restraint check (limited palette, states explicit, reduced motion, no decorative motion). Neither overrode PRODUCT.md or our tokens.
- **Evidence.** Source of `src/app/page.tsx`, `src/features/overview/*`, `src/features/campaigns/*`, `src/features/creatives/*`, `src/components/shell/*`, `src/components/ui/*`, `src/app/globals.css`; rendered text of `/`, `/campaigns`, `/creatives` from the running dev server; the three research documents; DECISIONS D-001 to D-017; DEVLOG through 2026-10-03. No screenshots were taken.
