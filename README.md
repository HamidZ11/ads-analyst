# Ad Analyst

Analytics for small marketing agencies running Meta Ads. Ad Analyst helps an agency see what changed, where performance is deteriorating, where money is being wasted, and where there is room to scale.

It covers the analysis surfaces (Overview, Campaigns, Creatives, Insights, Ask Analyst), Meta Ads CSV import, and hosted persistence on Supabase (Postgres, Auth, Row Level Security) with workspace isolation. There is no external ad API and no AI model.

## Run locally

### Demo mode (no setup)

```bash
pnpm install
pnpm dev
```

Without Supabase variables, `pnpm dev` serves the seeded demo clients read-only, with no sign-in. http://localhost:3000 is the public landing page (pricing at `/pricing`); the app starts at http://localhost:3000/overview. Switch clients from the top-left of the sidebar (or the top bar on mobile). Imports are disabled in demo mode.

### With Supabase (sign-in, imports, persistence)

1. Create a Supabase project (or run `supabase start` locally with the Supabase CLI).
2. Apply the migrations in `supabase/migrations/`: `supabase link --project-ref <ref>` then `supabase db push`, or paste the SQL into the SQL editor in order.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`). No service-role key is used.
4. In Authentication → URL Configuration, set the Site URL (for example `http://localhost:3000`) and add `http://localhost:3000/auth/callback` (and your production `/auth/callback`) to the redirect URLs. Keep the Email provider enabled.
5. `pnpm dev`, open http://localhost:3000/sign-in, sign in with your email and open the link in the same browser. The first sign-in creates your workspace; import a Meta Ads CSV from Clients.

Set `AD_ANALYST_ALLOW_SIGNUPS=false` to stop new addresses creating accounts, and `NEXT_PUBLIC_SITE_URL` when the public origin differs from the request host. A production build without Supabase variables shows "Not connected yet" unless `AD_ANALYST_DEMO_MODE=true`.

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
    import/       Meta CSV reader, mapping, validation, normalisation and the import payload
    supabase/     Workspace gateway (Postgres functions) and the snapshot repository
  lib/supabase/   Deployment mode and the server Supabase client
  proxy.ts        Session refresh and route protection (Next.js 16 proxy)
supabase/
  migrations/     Versioned SQL: tables, constraints, indexes, RLS policies, functions
  features/       Product features composed from domain + data (workspace, analytics queries, pages' parts)
  components/     Design-system primitives (ui/) and the application shell (shell/)
  lib/            Small helpers
```

Product and domain logic never import from `components/` or `app/`.

## Data model

Agency → Client → Ad Account → Campaign → Ad Set → Ad → Creative.

Daily metrics (`spend`, `revenue`, `conversions`, `impressions`, `clicks`) are stored once, at ad level. Every higher level and every ratio (CTR, CPC, CPM, CPA, ROAS, conversion rate) is derived on demand by the utilities in `src/domain/metrics.ts`.

The repository interface in `src/data/repository.ts` is the only read path. In demo mode it is backed by the seed; with Supabase, each request loads the active workspace through one RLS-scoped database function into the same interface, so pages never query the database. Writes (imports, targets) go through Postgres functions that run in one transaction under the user's own permissions. See D-048 to D-053 in `docs/DECISIONS.md`.

## Seeded data

The dataset is generated deterministically (seeded PRNG) and anchored to today's date, so "last 7 days" always has data. It covers 60 days for three clients of the agency Northstar Media:

- **Luxe Skin Co.** (ecommerce, GBP, Europe/London, target CPA £28, target ROAS 3.5x) — the flagship client, with nine campaigns and 27 ads whose numbers contain a scaling winner, a fatigued creative, a wasteful campaign, a recovering campaign, an underfunded strong ad and a campaign whose spend rises while conversions fall.
- **Peak Fitness** (local lead generation, GBP, Europe/London, target CPA £18).
- **Arc Cloud** (SaaS, USD, America/New_York, target CPA $85).

Patterns are expressed only as trajectories of spend, CPM, CTR, CVR and order value; nothing is flagged. `src/data/seed/seed.test.ts` asserts that each pattern is detectable from the numbers alone.
