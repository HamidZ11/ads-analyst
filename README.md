# Ad Analyst

Analytics for small marketing agencies running Meta Ads. Ad Analyst helps an agency see what changed, where performance is deteriorating, where money is being wasted, and where there is room to scale.

This repository is the **foundation release (APP 01)**: application shell, design system, typed multi-client domain model, deterministic seeded demo data, navigation and responsive layout. There is no authentication, no external ad API, no AI and no CSV import yet.

## Run locally

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000. Switch between the seeded clients with the client switcher in the top-left of the sidebar (or the top bar on mobile).

## Scripts

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Start the development server                      |
| `pnpm build`        | Production build                                  |
| `pnpm lint`         | ESLint                                            |
| `pnpm typecheck`    | TypeScript                                        |
| `pnpm test`         | Vitest unit tests                                 |
| `pnpm format`       | Prettier (write)                                  |
| `pnpm format:check` | Prettier (check)                                  |
| `pnpm check`        | Format check, lint, typecheck, test, build in one |

## Design and engineering records

- [DESIGN.md](DESIGN.md): concrete visual system rules (tokens, type scale, spacing, components, charts, states, responsive, what not to do).
- [docs/DEVLOG.md](docs/DEVLOG.md): one entry per implementation pass.
- [docs/DECISIONS.md](docs/DECISIONS.md): settled architectural, product and design decisions.

## Structure

```
src/
  app/            Next.js App Router routes (one folder per page)
  domain/         Pure domain model: types, period slicing, metric aggregation, formatting, labels
  data/           Repository contract, in-memory implementation and the seed generator
    seed/clients/ One seed spec per client (trajectories only, no pattern flags)
  features/       Product features composed from domain + data (workspace, analytics queries, pages' parts)
  components/     Design-system primitives (ui/) and the application shell (shell/)
  lib/            Small helpers
```

Product and domain logic never import from `components/` or `app/`.

## Data model

Agency → Client → Ad Account → Campaign → Ad Set → Ad → Creative.

Daily metrics (`spend`, `revenue`, `conversions`, `impressions`, `clicks`) are stored once, at ad level. Every higher level and every ratio (CTR, CPC, CPM, CPA, ROAS, conversion rate) is derived on demand by the utilities in `src/domain/metrics.ts`.

The repository interface in `src/data/repository.ts` is the only read path. The in-memory implementation is seeded; a persistent implementation can replace it when CSV imports arrive without touching features.

## Seeded data

The dataset is generated deterministically (seeded PRNG) and anchored to today's date, so "last 7 days" always has data. It covers 60 days for three clients of the agency Northstar Media:

- **Luxe Skin Co.** (ecommerce, GBP, Europe/London, target CPA £28, target ROAS 3.5x) — the flagship client, with nine campaigns and 27 ads whose numbers contain a scaling winner, a fatigued creative, a wasteful campaign, a recovering campaign, an underfunded strong ad and a campaign whose spend rises while conversions fall.
- **Peak Fitness** (local lead generation, GBP, Europe/London, target CPA £18).
- **Arc Cloud** (SaaS, USD, America/New_York, target CPA $85).

Patterns are expressed only as trajectories of spend, CPM, CTR, CVR and order value; nothing is flagged. `src/data/seed/seed.test.ts` asserts that each pattern is detectable from the numbers alone.
