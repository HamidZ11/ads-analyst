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

Set `NEXT_PUBLIC_SITE_URL` to the production origin: sign-in emails, canonical URLs, the sitemap and robots.txt use it (see Search and indexing), and a production build refuses to send sign-in links without it. `AD_ANALYST_ALLOW_SIGNUPS=false` stops the app asking Supabase to create accounts; to actually close sign-ups, also turn off "Allow new users to sign up" in Supabase Auth. A production build without Supabase variables shows "Not connected yet" unless `AD_ANALYST_DEMO_MODE=true`.

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

The repository interface in `src/data/repository.ts` is the only read path. In demo mode it is backed by the seed; with Supabase, each request loads the active workspace through one RLS-scoped database function into the same interface, so pages never query the database. Writes (imports, targets) go through Postgres functions that check the caller and their membership and run in one transaction; users cannot write tables directly. See D-048 to D-053 and D-060 in `docs/DECISIONS.md`.

## Seeded data

The dataset is generated deterministically (seeded PRNG) and anchored to today's date, so "last 7 days" always has data. It covers 60 days for three clients of the agency Northstar Media:

- **Luxe Skin Co.** (ecommerce, GBP, Europe/London, target CPA £28, target ROAS 3.5x) — the flagship client, with nine campaigns and 27 ads whose numbers contain a scaling winner, a fatigued creative, a wasteful campaign, a recovering campaign, an underfunded strong ad and a campaign whose spend rises while conversions fall.
- **Peak Fitness** (local lead generation, GBP, Europe/London, target CPA £18).
- **Arc Cloud** (SaaS, USD, America/New_York, target CPA $85).

Patterns are expressed only as trajectories of spend, CPM, CTR, CVR and order value; nothing is flagged. `src/data/seed/seed.test.ts` asserts that each pattern is detectable from the numbers alone.

## Search and indexing

Implemented (D-057, D-058):

- Only `/` and `/pricing` are indexable. The root layout marks every route `noindex, nofollow` and the `(marketing)` layout opts its pages back in, so the app, sign-in and 404 pages stay out of search results, and so does any new page outside `(marketing)`.
- `NEXT_PUBLIC_SITE_URL` is the single source of the production origin (`src/lib/site.ts`). Set at build time, it gives `/` and `/pricing` canonical and Open Graph URLs, fills `/sitemap.xml` with exactly those two URLs and adds the sitemap to `/robots.txt`. Unset or localhost, all three are left out rather than guessed.
- `/robots.txt` allows everything except `/api/` and `/auth/`. App pages and sign-in are deliberately not disallowed: the site links to them, and crawlers must fetch them to see their noindex (signed-out crawlers are redirected to sign-in). robots.txt is not access control; the proxy, the data layer and RLS are.
- Unknown URLs return a real 404 (noindex). App pages still send signed-out visitors to sign-in, and the API still answers 401.
- The home page has JSON-LD: `WebSite` (the site name, once the origin is set) and `SoftwareApplication` (name, category, "Web" and the hero lead). There are no offers, ratings, reviews, FAQ or breadcrumb schema.
- Share cards are text-only (`summary`). The favicon is the marketing mark.

Launch-only:

1. Set `NEXT_PUBLIC_SITE_URL` in the production build. Make http→https and www/apex redirects single hops at the host.
2. Keep preview and staging deployments out of search (a host-level `X-Robots-Tag: noindex`, or access protection).
3. Verify the domain in Google Search Console, submit `/sitemap.xml`, inspect `/` and `/pricing`, request indexing where useful, then monitor page indexing, enhancements and Core Web Vitals.
4. Validate the home page JSON-LD with the Rich Results Test or the Schema Markup Validator.
5. Add Open Graph artwork (1200×630) once approved artwork exists.
6. Backlinks are off-site work: launch directories, agency and founder communities, useful original research, partnerships and real mentions. Nothing automated or paid.

## Security

Implemented (D-051, D-059, D-060):

- Tenant isolation is enforced in Postgres: RLS on every table keyed on workspace membership, composite foreign keys that keep children in their parent's workspace, and no service-role key. Cookies (`aa_client`, `aa_workspace`) only choose among rows the user can already read.
- One write boundary. Signed-in users can only read tables directly, through RLS (`workspace_members` not at all). Every write goes through a Postgres function that checks the caller, their membership and the input: `import_meta_csv` (imports), `update_client_targets` (targets), `ensure_default_workspace` (first sign-in) and `consume_rate_limit`. The two data writers run with owner rights and an empty `search_path`, so they check membership themselves; no table is directly writable. RLS policies stay in place as defence in depth.
- The proxy and the data access layer both verify the session (`auth.getClaims()`); route handlers and server actions re-check it next to the data. Supabase session cookies are HTTP-only, `SameSite=Lax`, and `Secure` in production.
- Imports are validated twice. The server re-parses the CSV (16 MB request, 10 MB CSV, 100,000 rows, 200 columns, 2,000 characters per cell), then `import_meta_csv` checks the payload's shape and sizes before writing, so a direct call cannot skip it. Limits per user and hour: 30 import attempts (spent by `/api/import` before it reads a file) and 30 written imports (counted in the import's own transaction). Import records name the caller.
- Every response carries a same-origin Content Security Policy (no nonces, so inline scripts are allowed), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, a referrer policy, a permissions policy and, in production, HSTS. `X-Powered-By` is off.
- Sign-in links only return to `NEXT_PUBLIC_SITE_URL` in production, never to an origin taken from request headers. The callback redirects to a fixed path; there are no user-supplied redirect targets.

Known limit (live configuration, see D-059): sign-in links are requested from the server, so Supabase's per-IP auth limits see the server's address, not the visitor's, and act as one shared bucket. It is handled at deployment, not in code: CAPTCHA, host rate limiting and tuned Supabase limits (items 7, 8 and 11 below).

Live validation before launch (none of this can be checked from the repository):

1. Apply all pending migrations in order (`supabase db push`) before deploying this code: without them imports fail closed (the rate-limit function is missing) and tables stay directly writable.
2. Run the two-user, two-workspace isolation check against the real project: each user sees only their own workspace in the app and through the Data API.
3. Verify direct table writes are denied: with a signed-in user's session and the publishable key, an `insert`, `update` or `delete` on any table returns "permission denied".
4. Verify controlled writes succeed: a CSV import, a re-import into the same client, and saving targets in Settings.
5. Auth → Providers: anonymous sign-ins are off.
6. Auth → Providers → Email: "Allow new users to sign up" matches the launch plan (`AD_ANALYST_ALLOW_SIGNUPS` alone does not close sign-ups).
7. Auth → Attack Protection: enable CAPTCHA (needs a small sign-in form change).
8. Auth → SMTP: configure custom SMTP; review Auth → Rate Limits with the shared server address in mind.
9. Auth → URL Configuration: Site URL is the production origin; redirect URLs list only exact `<origin>/auth/callback` entries, with no broad wildcards.
10. HTTPS only, and `NEXT_PUBLIC_SITE_URL` set to the production origin in the production build.
11. Host rate-limit rules for `POST /sign-in` and `/api/*`.
12. Preview and staging deployments use a separate Supabase project, never production.
13. Spend caps and usage alerts on the Supabase and hosting plans. There is no paid AI or external API in the app.

## Before Launch

Ad Analyst is currently parked. Before a production launch:

1. Create or attach a production Supabase project.
2. Validate authentication, RLS and two-user workspace isolation against the real database.
3. Decide how the public demo should work in production.
4. Add billing and subscription handling.
5. Add a real sales/support contact email.
6. Deploy the production application.
7. Validate imports with a real Meta Ads export.
8. Get the product in front of real users before building additional features.
