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
- Real data arrives through Meta Ads CSV import (ad-level daily exports) into a signed-in workspace; platform API connections arrive later. A deterministic seeded dataset for three demo clients (Luxe Skin Co., Peak Fitness, Arc Cloud) is served only in demo mode (local development or an explicit demo deployment) and is never stored in or mixed with a workspace.
- Each person signs in with an emailed one-time link and works in one workspace; the first sign-in creates it. Workspaces can have several members in the data model, but switching and inviting are not built.
- Each client has its own currency, timezone and vocabulary for conversions (purchases, leads, trials).

## Capabilities and Constraints

- Implemented: application shell, client switcher, date presets and period comparisons, interactive Overview charts, Campaigns ledger, Creatives board and inspector, deterministic Insights with fatigue proxies and winner signals, and a deterministic Ask Analyst thread (all locked). Meta Ads CSV import (four visible steps: Upload, Review setup, Review import, Import, over an automatic parse, map and validate pipeline) creates or refreshes imported clients that every page reads through the same repository; the Clients page lists sources and imports, and Settings edits optional targets for imported clients. CSV import passed manual review.
- Data handling: imported data is stored in Supabase Postgres, scoped to the workspace by Row Level Security on every table; each import is written in one transaction and re-imports update days rather than double counting (D-048 to D-053). The live Supabase project still has to be configured and verified end to end. Column recognition is built from documented Ads Manager labels and synthetic fixtures; real Ads Manager exports still need validation before release. CSV exports carry no creative artwork; imported creatives show a neutral placeholder and "Format unknown" when the export has no format column.
- Deliberately not yet built: custom date ranges, campaign drilldown, external LLM interpretation, persistent Ask history, Meta API connection and sync, deleting imported data, workspace switching and member invitations, password or OAuth sign-in, editable settings for demo clients, dark theme.
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
