# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Operators and performance marketers at small marketing agencies, managing paid social for several clients at once. They work desktop-first in long analytical sessions, scanning many entities quickly and deciding where to act: what to scale, what to pause, what to fix. Secondary audience (confirmed by the product owner): the agency's clients, who see outputs such as screenshots and summaries rather than operating the product.

## Product Purpose

Ad Analyst is an analytics product for small marketing agencies. It shows what changed in a client's paid-social performance, helps the user understand why, and catches wasted spend early. Success is a user who, within seconds of opening a client, knows how performance is doing, what moved, and where attention should go.

## Positioning

Agency-shaped from the start: a multi-client workspace where one selected client drives every page, with the client's own targets (cost per conversion, return on ad spend) framing every number. Findings are computed deterministically from daily metrics before any model-generated explanation is layered on, so every statement can be traced to the figures behind it.

## Operating Context

- Meta Ads is the first and currently only platform modelled; the hierarchy is agency → client → ad account → campaign → ad set → ad → creative.
- Daily metrics (spend, revenue, conversions, impressions, clicks) are stored at ad level; every ratio and roll-up is derived on demand.
- The default comparison is the last 7 days against the previous 7 days, with 1, 7, 14 and 30-day presets; custom ranges are a later release.
- Phase APP 01 ships with a deterministic seeded dataset for three demo clients (Luxe Skin Co., Peak Fitness, Arc Cloud). Platform API connections and CSV import arrive in later phases.
- Each client has its own currency, timezone and vocabulary for conversions (purchases, leads, trials).

## Capabilities and Constraints

- Shipped (APP 01): application shell, client switcher, date presets, Overview with real seeded values, Campaigns table, Creatives grid, honest placeholders for Insights and Ask Analyst, Clients list, read-only Settings.
- Deliberately not yet built: interactive charts and the full date engine (APP 02), campaign drilldown, creative fatigue and winner signals, the deterministic insight engine (APP 05), Ask Analyst wiring, CSV import, authentication, editable settings, dark theme.
- Terminology: "conversions" is rendered per client as purchases, leads or trials; CPA is cost per conversion; ROAS is return on ad spend as a multiple.
- Constraint: no feature may fabricate findings; placeholders state what will appear and what produces it.
- Constraint: desktop (1440, 1280) is the primary target; 390 and 360 must stay clean and usable without sacrificing desktop density.

## Brand Commitments

- Working name "Ad Analyst"; the agency in demo data is Northstar Media.
- Constraints the product owner set for the design phase (recorded as constraints, not as a visual system; the visual language itself is decided and documented in `DESIGN.md` during design work): white base with pale cool-grey surfaces, dark navy or near-black text, blue as the single primary accent, dense but controlled layouts suited to desktop-heavy analytical work.
- Looks the owner has explicitly rejected: generic SaaS template, default shadcn look, cards inside cards, purple or "AI" gradients, large empty whitespace, excessive pills, oversized rounded corners, weak tiny typography, decorative gimmicks.
- Motion rules are tokenised in `DESIGN.md` §20 (transform and opacity first, `prefers-reduced-motion` mandatory) and carry across redesigns.

## Evidence on Hand

- Seeded demo data in `src/data/seed/` with six deliberate, detectable performance patterns in the flagship client (scaling winner, fatigued creative, wasteful campaign, recovering campaign, underfunded strong ad, spend rising while conversions fall).
- Three product-screen references supplied by the product owner (a light sprint-planning dashboard, a layout wireframe, a dark rituals dashboard), used for composition only.
- No real customer data, testimonials, logos, benchmarks or pricing exist. Future work must not fabricate any.

## Product Principles

1. Lead with what changed, then why, then what to do; never with decoration.
2. Every number carries its comparison or its target.
3. Computed facts before generated explanations.
4. One selected client drives everything; context is never ambiguous.
5. Density serves scanning; whitespace separates sections, not components.

## Accessibility & Inclusion

Baseline required by the product owner: semantic headings, labelled controls, keyboard navigation, visible focus states, sufficient contrast, real table semantics, and `prefers-reduced-motion` honoured for every non-essential transition.
