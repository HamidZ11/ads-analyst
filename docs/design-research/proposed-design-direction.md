# Proposed design direction — Ad Analyst (for approval, not yet implemented)

Synthesises: the current UI critique (`current-ui-critique.md`), Impeccable's Operate-mode guidance (`.claude/skills/impeccable/reference/operate.md`, `craft-floor.md`), the five selected DESIGN.md references (`design-md-references.md`), the two installed style skills (`.claude/skills/premium`, `.claude/skills/clean`), and the product truths in `PRODUCT.md`. Nothing below changes production code or the committed `DESIGN.md` until approved.

## 1. Why the current UI feels generic (one paragraph)

Every element is the default rendering of its type and every element has equal weight. The product's character lives in its data (targets framing every number, six seeded performance stories, a client-first hierarchy) and the design never expresses it: a generic title leads, six identical cells follow, the only chart is introduced at 13px, the one sentence that says what changed sits in a grey panel of prose, and the rail is a stock admin kit. The type scale has no middle, so hierarchy is attempted with four greys instead of size and weight; hairline containers replaced card containers without changing the composition.

## 2. The design stack

| Layer              | Tool                                                                                                                                                                                                 | Role                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Critique and gates | **Impeccable** (`/impeccable critique`, `audit`, `layout`, `typeset`, `distill`, `clarify`, `polish`), its 61-rule detector on every UI edit via the project hook, and `PRODUCT.md` as product truth | Decides whether a change made the surface more specific to this product; blocks anti-patterns deterministically |
| Structural grammar | **Vercel** (type scale and tracking discipline), **IBM Carbon** (density, grid, hairline hierarchy), **Coinbase** (scarce single blue, semantic colour as text, number register)                     | Supplies the measurable rules the redesign must obey                                                            |
| Supporting grammar | **Stripe** (tabular figures, dashboard pacing), **Cal.com** (surface alternation, hover restraint, radius ceiling)                                                                                   | Fills the gaps the three primary references leave                                                               |
| Style skills       | **premium** (Apple-grade precision, Inter, 12–36 scale, 4–32 spacing) and **clean** (simplicity, limited palette, explicit states, reduced-motion)                                                   | Keep generated UI opinionated and restrained; **our tokens override theirs** (see §4)                           |

Rejected from the skills registry: `professional` (Poppins, yellow accent, "electronics shop" brand), `modern` and `refined` and `editorial` (serif display, editorial pacing), `contemporary` (bento grids), `corporate` (Open Sans/Poppins, generic enterprise), `enterprise` (dark, glass panels), `stitch` (Ubuntu/Oswald, cream and orange), `impeccable` (orange editorial poster). Each contradicts the brief or duplicates what `premium`/`clean` already say.

How they work together: Impeccable owns the loop (shape → build → critique → polish) and the detector gate; the DESIGN.md references supply the numbers (sizes, tracking, spacing, grid, colour scarcity) that go into our own `DESIGN.md`; the style skills bias generation toward precision and restraint while deferring to our tokens. No layer introduces a second visual system.

## 3. Direction: "the analyst's instrument"

A light, precise, high-contrast instrument panel rather than a report. Three moves:

1. **One thing leads.** Each page states its headline in a single hero figure or sentence sized at 32–36px, with its delta and target beside it. On the Overview this is the client's primary outcome for the period (for ecommerce: purchases and cost per purchase against target; for lead gen: leads and cost per lead; for SaaS: trials and cost per trial). The remaining metrics become a quiet supporting row at 15–18px. The chart becomes the second element, titled at 18px, annotated with the previous-period level and the change.
2. **Typography does the hierarchy.** Five steps, sentence case, 600 ceiling: 13px body (400), 15px emphasis (500), 18px section (600, -0.01em), 24px lead (600, -0.02em), 32–36px hero (600, -0.03em). Numbers get their own register: tabular, one weight step above adjacent text, navy ink. Three ink levels per view, not four.
3. **Composition, not containers.** One 12-column grid with 24px gutters that every section aligns to; at most two outlined regions per view; consecutive sections alternate white and one tinted band; whitespace separates, hairlines divide rows only. Blue appears on the selected period, the selected series, the active nav item and one primary action, and nowhere else.

## 4. Proposed rule changes to DESIGN.md (not merged)

- Type scale (§5): add 15/18/32/36 steps; set the title at 32px when a page has one headline figure, else 24px; numerals get a tabular 500/600 register rule.
- Composition (§1, §8): "at most two outlined regions per view", "alternate surface modes", "one page grid", "no release-schedule copy in the UI".
- KPI band (§8a): replace "six cells of equal weight" with "one lead figure plus a supporting row"; the lead figure is chosen per client type from the vocabulary rules.
- Charts (§13): heading at 18px; a dotted previous-period reference level; a change callout at the end of the series; drop the secondary mini-chart unless it says something the band does not.
- Tables (§9): change-column headers read "vs prev."; status as a dot; group headers for volume vs efficiency; primary numeric column one weight step up.
- Creatives (§8b): one lead metric per card, two supporting; a lead card or ranked rhythm; placeholder motifs with fewer, larger shapes and higher tone contrast.
- Navigation (§10): proprietary mark; switcher as a quiet row; groups by spacing; an active state that is not the pale-blue pill (a 2px accent rule and ink text is the candidate).
- Colour (§4): keep; add "blue never appears more than four times in a viewport".
- Tokens the style skills bring that we do **not** adopt: `premium`'s secondary purple (#8B5CF6), `clean`'s Roboto/Poppins and 8pt-only grid. Our `globals.css` tokens win on any conflict.

## 5. Sequence (when approved)

1. `/impeccable layout` on the Overview with the hierarchy decision from the critique's first question.
2. `/impeccable typeset` across the shell and the three pages (scale and number register).
3. `/impeccable distill` to remove containers, copy and chrome that do not carry meaning.
4. `/impeccable clarify` on table headers, abbreviations and empty-state copy.
5. `/impeccable polish` on the sidebar and controls.
6. `/impeccable critique` again; target ≥ 30/40 and a "specific to this product" verdict before commit.

Chart interaction and motion remain APP 02. No AI, no CSV, no new features.
