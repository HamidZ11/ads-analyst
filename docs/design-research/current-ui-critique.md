# Current UI critique — Ad Analyst (APP 01.5 working tree)

> **Status (2026-10-03):** this critique assessed the APP 01.5 implementation, which was rejected and removed; production UI is back at the APP 01 baseline (`40eea2c`). Findings specific to 01.5 (the KPI band, the period-summary panel, hairline-everything, the editorial creative cards) describe the discarded state. Findings 2, 4, 7, 8 and 10 (type scale, roadmap copy, chart framing, table noise, sidebar chrome) apply to the baseline unchanged and remain the working list for the next pass.

⚠️ DEGRADED: single-context (sub-agent delegation is disabled by this session's operating policy; Assessment A and Assessment B were run sequentially in one context, A before B, and are declared as such)

**Method:** Impeccable `critique` playbook v4.5.0, run inline. Assessment A: design review of the source (`src/app/page.tsx`, `src/features/overview/*`, `src/features/campaigns/campaigns-table.tsx`, `src/features/creatives/*`, `src/components/shell/*`, `src/components/ui/*`) plus the rendered HTML of `/`, `/campaigns` and `/creatives` from the dev server. Assessment B: `impeccable detect --json src/` (deterministic, 61 rules). Browser overlay inspection was not available (no browser automation in this session; screenshots are deliberately not taken per project rules).
**Target:** the three surfaces that failed visual review (Overview, Campaigns, Creatives) and the sidebar. Mode: **Operate**.
**Date:** 2026-10-03. Working tree: `feat/foundation` with the uncommitted APP 01.5 pass on top of commit `40eea2c`.

---

## Design health score

| #         | Heuristic                       | Score     | Key issue                                                                                                                                |
| --------- | ------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of system status     | 3         | Period and comparison are stated on every page; pending states exist. No "data as of" on the page body itself (only in the rail footer). |
| 2         | Match system / real world       | 3         | Meta vocabulary and per-client conversion words are right. Two table columns are headed only "Δ".                                        |
| 3         | User control and freedom        | 2         | Comparison baseline cannot be changed; Custom range disabled; no column control.                                                         |
| 4         | Consistency and standards       | 3         | Headers, controls and spacing are consistent; the consistency is of a template, not of a product.                                        |
| 5         | Error prevention                | 3         | Few inputs; search and filters cannot produce an error state.                                                                            |
| 6         | Recognition rather than recall  | 2         | CPA, ROAS, CTR, "Δ" and "vs previous 7 days" are never explained in place; no tooltips.                                                  |
| 7         | Flexibility and efficiency      | 2         | No keyboard shortcuts, saved views, column choice or quick client switch (⌘K).                                                           |
| 8         | Aesthetic and minimalist design | 2         | Monotone grey, hairline-everything, six equal metric cells, roadmap copy inside the UI.                                                  |
| 9         | Error recovery                  | 3         | Empty states exist and explain; nothing else to recover from yet.                                                                        |
| 10        | Help and documentation          | 1         | None. In-product "arrives with a later release" notes stand in for help.                                                                 |
| **Total** |                                 | **24/40** | **Functional, undistinguished**                                                                                                          |

## Design specificity verdict

**LLM assessment:** Category-interchangeable. Swap the seeded data for support tickets or SaaS MRR and nothing on the Overview, Campaigns or Creatives pages would need to change. The composition is correct in principle (one client, metrics above a chart, a summary rail, a table) but every element is the default rendering of its type: a 24px title under a 12px eyebrow, a band of six identical cells, a line chart with an area wash, a tinted panel of prose, a shadcn-style combobox in a grey rail with a pale-blue active pill. The product's actual character (targets framing every number, the six seeded performance stories, the agency-to-client hierarchy) is present in the data and invisible in the design.

**Deterministic scan:** `impeccable detect --json src/` returned **0 findings** across the source tree (exit 0). The detector's anti-pattern catalogue (gradient text, glass panels, generic hero copy, decorative blur, icon soup, placeholder copy) is clean. That is expected: the problem is not a banned pattern, it is the absence of a point of view. Detector and reviewer therefore agree on what is _not_ wrong and the detector cannot see what is.

**Visual overlays:** not attempted; no browser automation available. Fallback signal: rendered-HTML inspection (class counts below) and source reading.

## Overall impression

Clean, consistent, tidy, and forgettable. The page reads as a well-formatted report rather than an analyst's instrument. Within three seconds a reader can find the spend figure, but cannot tell what matters: six numbers are presented with equal weight, the one chart is titled at 13px, and the only sentence that answers "what changed" is buried in a grey panel of prose. The single biggest opportunity is hierarchy: decide what the page is _about_ on this client this week and make that one thing unmistakable.

## What is working (preserve)

1. **Numbers carry their context.** Every KPI shows its change against the baseline and, where a target exists, its position against the target in words ("12.4% under £28 target"). This is the product's core idea and it is already true on screen.
2. **Vocabulary follows the client.** Purchases, leads and trials; cost per purchase versus cost per lead; ROAS hidden where it is not tracked. The system respects the domain.
3. **Restraint is real where it exists.** One blue, green and red only on deltas, no shadows, sentence-case headers, tokenised motion with a reduced-motion guard, honest empty states. These are the right foundations to build character on, not things to undo.
4. **The Campaigns table** has the right density and sort behaviour; its structure should survive the redesign.

## Priority issues

**[P0] No focal hierarchy on the Overview.**
Why it matters: an analyst's first question is "how are we doing" and the page answers with six co-equal 24px numbers, a generic word ("Overview") as the largest text, and the dominant chart introduced by a 13px label. Nothing leads.
Fix: make one thing lead per client type (spend against outcome, or the primary efficiency metric against target) at 32–40px with its delta beside it; demote the remaining metrics to a quieter supporting row; title the page with the client, not the word "Overview"; give the chart a 16–18px heading. Decide the hierarchy from the seeded stories, then render it.
Suggested command: `/impeccable layout`, then `/impeccable typeset`.

**[P1] Typography has no middle and no contrast.**
Why it matters: rendered pages use only `text-2xs/xs/sm/base/2xl` (11–14px, then 24px). Everything between is missing, four greys do the work that size and weight should do, and the user's reaction ("weak tiny typography") is correct. The page feels inexpensive because it is set in two sizes.
Fix: a five-step scale with real intermediate steps (13 body / 15 emphasis / 18 section / 24 lead / 32–36 hero), 600 ceiling, tracking that tightens with size, tabular numerals in a heavier register than the text beside them, and no more than three ink levels per view.
Suggested command: `/impeccable typeset`.

**[P1] Hairline-everything replaced card-everything.**
Why it matters: the Overview renders 41 `border-border` instances, Creatives 90. The band, the summary panel, the top-campaigns table and the account strip are all outlined or tinted boxes, so the "open composition" intent of APP 01.5 is not visible; it is the same grid of boxes drawn with thinner lines, with no change of texture between sections.
Fix: at most two outlined regions per view; alternate surface modes between consecutive sections (white → one tinted band → white); use one shared page grid so sections align instead of each choosing its own split; let whitespace do the separating.
Suggested command: `/impeccable distill`, then `/impeccable layout`.

**[P1] Roadmap copy inside the product.**
Why it matters: "Findings arrive with the insight engine", "Ad set and ad drilldown … arrive with the campaign analysis release", "Fatigue and winner signals … arrive with the creative analysis release" are development notes rendered as UI. They are the most recognisable template-and-AI tell on the pages and they would appear in every client screenshot.
Fix: remove release-schedule copy from the UI entirely; keep it in `docs/DEVLOG.md`. Empty states describe the outcome the user will get and what produces it, in product voice.
Suggested command: `/impeccable clarify`.

**[P2] Campaigns table: semantic noise where it should be quiet.**
Why it matters: two columns are headed "Δ" with no visible distinction; eight rows repeat an "Active" badge that says nothing; every delta is coloured, so colour stops meaning "look here"; secondary numerics sit at the same size as the primary.
Fix: head the change columns "vs prev." under their metric group; show status as a dot and move the word to the filter; keep the colour but let the numeral weight distinguish spend from the rest; consider grouping columns (volume · efficiency).
Suggested command: `/impeccable clarify`, then `/impeccable layout`.

**[P2] Creatives still read as a product grid.**
Why it matters: 26 identical cards with 4:3 abstract placeholder art, a four-column metric strip with deltas under each value, and a CTR row with a sparkline; every card has equal weight and the abstract motifs, at card size, look generated rather than designed. A creative-performance product should make the best and worst creative obvious at a glance.
Fix: fewer metrics per card (one lead figure, two supporting), a visible ranking or position cue, stronger composition contrast in the placeholder art (fewer, larger shapes; tone-on-tone contrast), and an editorial rhythm (a lead card, then the grid).
Suggested command: `/impeccable layout`.

**[P3] The sidebar is template chrome.**
Why it matters: a generic "A" glyph in an ink square, a bordered combobox client switcher, uppercase group labels and a pale-blue active pill are the defaults of every current admin kit. The rail is the one element on every screen and it says nothing about the product.
Fix: a proprietary mark; the client switcher as a quiet row (initials, name, chevron on hover) rather than a bordered control; groups separated by space, not labels; an active state that is not the pale-blue pill.
Suggested command: `/impeccable polish`.

## Top 10 issues (consolidated, for the owner)

1. Overview has no focal point: six equal metric cells and a 13px chart title under a 24px generic page title. (hierarchy, composition)
2. Only two effective type sizes in use (11–14px and 24px); no intermediate step; hierarchy is attempted with grey instead of size and weight. (typography)
3. Hairline containers everywhere (41 on Overview, 90 on Creatives); open composition is claimed in the docs but not visible. (composition)
4. Release-schedule copy rendered in the UI on three pages. (copy, template tell)
5. Period summary is a tinted panel of prose with inline deltas; it is the most important content on the page and the hardest to scan. (hierarchy, composition)
6. Sections use different column structures (full band, 1fr+300px, 2:3, inline strip) with no shared grid; the page does not align with itself. (spacing, composition)
7. Chart framing is generic: area wash, three ticks, a shaded band; no annotation of the comparison or of what changed; the secondary conversions chart repeats the band without adding reading. (charts)
8. Campaigns table: duplicate "Δ" headers, repeated status badges, colour on every delta, uniform numeral weight. (tables, clarity)
9. Creatives: equal-weight grid, busy four-column metric strip, placeholder motifs that read as generated art. (composition, typography)
10. Sidebar: generic mark, shadcn-style switcher, uppercase group labels, pale-blue active pill. (sidebar, template tell)

## Findings by area

**Hierarchy:** no lead metric; title is a category word; chart title smaller than the KPI labels' context lines; the period summary (the "what changed" content) is visually tertiary.
**Typography:** 11/12/13/14/24px only; four greys (`ink`, `ink-secondary`, `ink-muted`, `ink-faint`) doing hierarchy work; numerals at 24px are the only strong element and there are six of them; no tracking variation except on the title.
**Spacing:** consistent 40–48px between sections, 16–20px inside; but constant rhythm with no compression or expansion, so nothing reads as grouped or separated more than anything else.
**Composition:** correct skeleton (header → metrics → chart + rail → lists → strip) rendered as a stack of outlined boxes; the rail only appears at 1280+, so at 1024–1279 the summary stacks under a 240px chart and the page becomes a long column.
**Charts:** 2px blue line, 8% wash, grey earlier period, selected band at 35% blue tint with a hairline edge; three y ticks; x labels at start/middle/end; an end marker. Competent and generic. No baseline for the previous period, no delta callout, no annotation; the conversions chart at 120px is too small to read and too large to ignore.
**Sidebar:** 240px grey rail; 28px ink mark with a generic glyph; bordered white switcher; uppercase "Analyse"/"Workspace" labels; 32px items; pale-blue active fill; two-line status footer. All default idioms.
**Tables:** sentence-case 12px headers (good), 44px rows, hairlines only (good); duplicate "Δ" headers; status badge per row; colour on every delta; totals row in the footer (good); name column truncates at 380px.
**Generic-AI / template tells:** eyebrow + generic title + muted subtitle; six-cell metric band with arrow deltas; area-wash line chart; tinted "summary" panel; roadmap copy; abstract SVG placeholders; pale-blue nav pill; combobox switcher; Inter at 13px grey throughout.
**What should be preserved:** the data model and vocabulary; targets beside numbers; one-blue rule and semantic-colour-as-text rule; sentence case; motion tokens and reduced-motion guard; table semantics and sort behaviour; the metrics-above-chart grouping; the idea (not the form) of a computed period summary; honest empty states (minus the schedule copy); the seeded performance stories as the material the hierarchy should be built from.

## Persona red flags

**Alex (power user, agency performance marketer):** no keyboard route to switch client or period; cannot change the baseline or pick columns; must read six equal numbers to find the one that moved. Will tab to the Campaigns table and ignore the Overview.
**Jordan (first-timer, junior account executive):** "Δ" appears twice with no legend; CPA/ROAS/CTR never expanded; "vs previous 7 days" appears 12 times on one screen. Will understand the table only after being told what the columns mean.
**Priya (agency account manager, project-specific: screenshots the Overview for a client on Monday):** the screenshot would contain "Findings arrive with the insight engine" and "compared with the previous 7 days" in grey; no headline figure; no sentence a client could read as the result. Will annotate the screenshot by hand.

## Minor observations

- The eyebrow repeats the client name shown 20px to its left in the rail.
- The segmented control's disabled "Custom" segment is visible on every page.
- "Daily purchases" heading uses the plural vocabulary but the band says "Purchases" and the summary says "purchases at £24.52 each"; three registers for one metric.
- The account strip labels ("Ad sets", "Ads", "Creatives") are counts without comparisons, the only numbers on the page without context.
- Creative cards show the aspect ratio ("9:16") as a chip; nobody acts on it.

## Questions for the owner (targeted; answered before any redesign starts)

1. **Hierarchy direction.** Which should lead the Overview for an ecommerce client: (a) spend with the outcome it bought (purchases and ROAS beside it), (b) the primary efficiency metric against target (cost per purchase, with the target line), or (c) the chart itself with the metrics as its caption?
2. **Tone.** The references split two ways: calm and institutional (Coinbase, IBM Carbon) or sharp and product-like (Vercel, Linear in light). Which is closer to "screenshot-worthy" for you?
3. **Scope.** Redesign the Overview first and let Campaigns and Creatives inherit the rules, or take all three in one pass?
4. **Off-limits.** Does the Campaigns table structure (columns, density, sort) stay as is, with only the header and status treatment changing?

Questions deliberately not posed through the interactive prompt: this pass is preparation only and the owner reviews documents, not a live session.
