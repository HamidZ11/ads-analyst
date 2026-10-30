# Deploying Ad Analyst

Going live is configuration, not code: one Supabase project, one Vercel project, a domain and a set of environment variables. This page covers each, then a go-live checklist against the launch checkpoints in `PRODUCT.md`. Security background is in the README ("Security") and D-059, D-060 and D-NEW-launch-csp in `docs/DECISIONS.md`.

Allow an afternoon. Do the steps in order: the app must not be deployed against a database that lacks the migrations.

## 1. Supabase project

1. **Create the project.** Region: London (`eu-west-2`), next to the Vercel functions (`lhr1` in `vercel.json`); every page reads the workspace from Postgres, so the two should sit together. Use a separate project for previews and staging, never production.
2. **Apply the migrations, in filename order.** Each depends on the one before:

   | Order | File                                                                        | What it does                                                                                                                               |
   | ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
   | 1     | `supabase/migrations/20261003170000_workspaces_and_imported_data.sql`       | Tables, composite foreign keys, RLS policies, `ensure_default_workspace`, `workspace_snapshot`, `import_meta_csv`, `update_client_targets` |
   | 2     | `supabase/migrations/20261004200000_rate_limits_and_import_attribution.sql` | `rate_limits` and `consume_rate_limit`; import records must name their author                                                              |
   | 3     | `supabase/migrations/20261004210000_controlled_write_boundary.sql`          | Revokes direct table writes; every write goes through the checked functions                                                                |

   With the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push` (it applies them in order and records them). Without it: paste each file into the SQL editor, in this order. Re-running a file is not supported.

3. **Authentication → Providers.** Email on. Anonymous sign-ins off. "Allow new users to sign up" set to the launch plan (on for open sign-up; off for an invite-only start, together with `AD_ANALYST_ALLOW_SIGNUPS=false`). No other providers: the app only has email links.
4. **Authentication → URL Configuration.**
   - Site URL: `https://adanalyst.app`
   - Redirect URLs: exactly `https://adanalyst.app/auth/callback`. Add `http://localhost:3000/auth/callback` only on a development project. No wildcards.
5. **Authentication → Email Templates.** The default "Magic Link" and "Confirm signup" templates work as they are: the link goes through Supabase and lands on `/auth/callback?code=…`. That code only works in the browser that asked for the link. To let people open the link on another device (common when email is read on a phone), change both templates' link to:

   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
   ```

   `/auth/callback` accepts both forms. Keep the wording plain: the product name, one line ("Use this link to sign in to Ad Analyst. It works once and expires in an hour."), the link, and "If you didn't ask for this, ignore this email." Set the expiry under Authentication → Providers → Email to match the sentence.

6. **Authentication → SMTP.** Configure a custom SMTP sender on the domain (for example `no-reply@adanalyst.app`, with SPF, DKIM and DMARC records from the provider). Supabase's built-in sender is rate-limited to a handful of emails an hour and is not for production.
7. **Authentication → Rate Limits and Attack Protection.** Sign-in links are requested from the server, so every visitor shares the server's address in Supabase's per-IP limits (D-059). Review the email limits with that in mind. CAPTCHA needs a sign-in form change that is not built.
8. **API keys.** Copy the Project URL and the publishable key (Project Settings → API Keys). Ad Analyst never uses the secret or service-role key; do not put it anywhere.
9. **Billing.** Set a spend cap and usage alerts.

## 2. Vercel project

1. **Import the repository** (Add New → Project). Framework preset: Next.js. `vercel.json` sets the install command (`pnpm install --frozen-lockfile`), the build command (`pnpm build`) and the function region (`lhr1`). The proxy (`src/proxy.ts`) runs on the Node.js runtime, the default in this Next.js version; nothing needs the Edge runtime.
2. **Node.js version:** 22.x or later (Settings → Build and Deployment). `package.json` declares `>=22`; Next.js 16 needs at least 20.9.
3. **pnpm version:** the repo pins `pnpm@11.24.0` in `packageManager`. Set `ENABLE_EXPERIMENTAL_COREPACK=1` (below) so Vercel uses exactly that version, and confirm the first build log shows pnpm 11.
4. **Environment variables** (next section), for Production and, with the staging Supabase project's values, for Preview.
5. **Deploy**, then run the go-live checklist.

### Environment variables

Every `NEXT_PUBLIC_` value is built into the client bundle and the server code at build time: change one, then redeploy. None is secret (the publishable key is public by design; RLS decides access). `.env.example` lists the app's own variables (the first eight).

| Variable                               | Production value                                          | Where it comes from                                        | Effect when unset                                                                                     |
| -------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://<ref>.supabase.co`                               | Supabase → Project Settings → API (Project URL)            | With the key also unset: "Not connected yet" on every page, `/api/health` 503, unless demo mode       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…`                                        | Supabase → Project Settings → API Keys (publishable key)   | As above                                                                                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Only on older projects, instead of the publishable key    | Supabase → Project Settings → API Keys → Legacy (anon key) | Ignored when the publishable key is set                                                               |
| `NEXT_PUBLIC_SITE_URL`                 | `https://adanalyst.app`                                   | The domain (section 3)                                     | Production refuses to send sign-in links; canonical URLs, sitemap and robots.txt leave the origin out |
| `NEXT_PUBLIC_CONTACT_EMAIL`            | The sales and support address                             | The owner                                                  | Audit and Enterprise mailtos, the footer address and contact lines are hidden                         |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK`      | `https://buy.stripe.com/…` once billing is decided        | Stripe Dashboard → Payment Links                           | The Agency "Subscribe" button is hidden                                                               |
| `AD_ANALYST_ALLOW_SIGNUPS`             | `true` or `false`, matching the Supabase sign-up setting  | Launch plan                                                | `true`: the app asks Supabase to create accounts for new addresses                                    |
| `AD_ANALYST_DEMO_MODE`                 | Not set on production. `true` only on the demo deployment | Section 4                                                  | Production without Supabase variables shows "Not connected yet"                                       |
| `ENABLE_EXPERIMENTAL_COREPACK`         | `1`                                                       | Vercel build setting                                       | Vercel picks a pnpm version from the lockfile, which may not be 11                                    |
| `VERCEL_GIT_COMMIT_SHA`                | Set by Vercel                                             | Vercel system variables (on by default)                    | `/api/health` reports `commit: null`                                                                  |

**Previews:** use the staging Supabase project's URL and key. Preview URLs change per deployment, so either leave `NEXT_PUBLIC_SITE_URL` unset on Preview (sign-in is then off there, by design) or give a staging branch a fixed domain, set the variable to it and add its `/auth/callback` to the staging project's redirect URLs.

## 3. Domain: adanalyst.app

1. Vercel → Project → Settings → Domains: add `adanalyst.app` and `www.adanalyst.app`, with `www` redirecting (308) to the apex.
2. At the registrar, create the DNS records Vercel shows (or move the nameservers to Vercel). Vercel issues the certificates.
3. `.app` is on the browsers' HSTS preload list as a whole, so the site only ever loads over HTTPS. The app also sends `Strict-Transport-Security: max-age=63072000; includeSubDomains` in production.
4. Email DNS (SPF, DKIM, DMARC) for the SMTP sender in section 1.6.

## 4. Demo deployment (AD_ANALYST_DEMO_MODE)

The demo is the seeded, read-only dataset for three demo clients, with no sign-in and no database. It is never mixed with a workspace: a deployment is in exactly one mode, decided once from its environment (`src/lib/supabase/config.ts`):

| Supabase URL and key | `AD_ANALYST_DEMO_MODE` | Mode                                                                   |
| -------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Set                  | anything               | `supabase`: sign-in required, workspace data. The demo flag is ignored |
| Unset                | `true`                 | `demo`                                                                 |
| Unset                | unset                  | `unconfigured` in a production build (`demo` in `pnpm dev`)            |

So a public demo is a **second deployment**: a second Vercel project from the same repository, with no Supabase variables and `AD_ANALYST_DEMO_MODE=true`, on its own domain (for example `demo.adanalyst.app`). Set `NEXT_PUBLIC_SITE_URL=https://adanalyst.app` on it too, so its marketing pages' canonical URLs point at the main site rather than competing with it.

Checking the mode:

- `GET /api/health` returns `{"ok":true,"mode":"demo"|"supabase",…}`, and `"demoFlagIgnored":true` if `AD_ANALYST_DEMO_MODE=true` was set beside Supabase variables (the deployment is **not** a demo).
- `pnpm check:deploy https://demo.adanalyst.app demo` and `pnpm check:deploy https://adanalyst.app supabase` check the mode, the headers and the gating in one go.

Not decided, and not built (README "Before Launch" 3): on the Supabase deployment, "Try the demo" links to `/insights`, which sends signed-out visitors to sign-in. Pointing those links at the demo deployment is a product decision and a small code change (a demo URL variable); until then the production site's demo links lead to sign-in.

## 5. Health and errors

- `GET /api/health`: public, uncached, no configuration values. 200 when the deployment is in `supabase` or `demo` mode, 503 when unconfigured. It does not query Supabase, so it says the deployment is up and configured, not that the database is reachable. Point an uptime monitor at it.
- Unknown URLs answer 404 with "Page not found". A failure inside a page shows "This page couldn't load" with "Try again" (which fetches the page again); a failure in the root layout itself, such as the session not loading, shows the standalone "Ad Analyst couldn't load" page (`src/app/global-error.tsx`). Neither shows error details; server logs carry them with the digest.

## 6. Security headers

Set on every page and API response:

- `Content-Security-Policy` from `src/proxy.ts`, with a fresh nonce per request: scripts only with the nonce or loaded by a nonced script (`'strict-dynamic'`), everything else same-origin, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'` plus Stripe Checkout and the customer portal (D-088), `frame-ancestors 'none'`. Inline styles are allowed. Adding any third-party script, font, image host or API means widening `src/lib/csp.ts`.
- From `next.config.ts`: `Strict-Transport-Security` (production), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, and a `Permissions-Policy` turning off camera, microphone, geolocation, payment, USB and topics. `X-Powered-By` is off.

`pnpm check:csp <origin>` loads every page in WebKit, Chromium and Firefox and fails on any policy violation or page that does not hydrate.

## 7. What the tests cannot prove

`src/data/supabase/rls.test.ts` and `schema.test.ts` run every migration on an in-process Postgres (PGlite) and prove that one user cannot read, insert, update, delete or move rows in another user's workspace on every table in `public` (discovered from the catalogue, so a new table fails the test until it is covered), even with write privileges restored. The Supabase pieces are emulated: the `anon` and `authenticated` roles, Supabase's own `auth.uid()` reading the `sub` claim from `request.jwt.claims`, and Supabase's default grants on `public`.

Not covered, and checked live in the go-live checklist instead:

- JWT signing, expiry and refresh, and the session cookies: the tests set claims directly; nothing verifies a token.
- PostgREST itself (the Data API) and the exact roles and grants of the real project, including anything changed by hand in the dashboard.
- Supabase Auth: email links, sign-up settings, rate limits, SMTP.
- The rest of the real `auth` schema (`auth.users` is a two-column stand-in).

## 8. Go-live checklist

Against the launch checkpoints in `PRODUCT.md`. Tick each in order.

**Checkpoint: live Supabase and RLS validation against a real project**

- [ ] Production project created in London, spend cap set (1.1, 1.9).
- [ ] Three migrations applied in order; `supabase migration list` shows all three on remote (1.2).
- [ ] Auth providers, URL configuration, templates, SMTP and rate limits set (1.3–1.7).
- [ ] Sign in as user A in one browser and user B in another (different emails). Each gets their own workspace; import a CSV as A; B sees no clients.
- [ ] With B's session and the publishable key, the Data API returns no rows from A's workspace for `clients`, `campaigns`, `ads` and `daily_metrics`, and `insert`, `update` and `delete` on any table return "permission denied" (README "Security", live validation 2–3).
- [ ] Re-import into the same client and save targets in Settings: both succeed (live validation 4).
- [ ] A sign-in link opened in a different browser works if the `token_hash` template was chosen, and fails with the "link" message if not.

**Checkpoint: billing**

- [ ] Out of scope for this pass. Until it lands, leave `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` unset unless the owner wants the Agency button live with manual reconciliation (D-065: nothing in the app knows whether a workspace has paid).

**Checkpoint: sales contact address**

- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` set in Production and redeployed; the audit and Enterprise mailtos and the footer address appear on `/` and `/pricing`.
- [ ] The address receives mail (send one).

**Checkpoint: a public demo for production deployments**

- [ ] Decide whether the production site's "Try the demo" should open a demo deployment (section 4); if so, that needs a small code change first.
- [ ] If a demo deployment is wanted now: second Vercel project, `AD_ANALYST_DEMO_MODE=true`, no Supabase variables, its own domain; `pnpm check:deploy https://demo.adanalyst.app demo` passes.

**Checkpoint: deployment itself**

- [ ] Vercel project set up with every variable for Production and Preview (section 2); first build log shows pnpm 11 and Node 22+.
- [ ] Domain live over HTTPS, `www` redirects (section 3).
- [ ] `pnpm check:deploy https://adanalyst.app supabase` passes: health 200 in `supabase` mode with no ignored demo flag, all security headers including HSTS, app pages redirect to sign-in, signed-out import refused, robots.txt and the sitemap name `https://adanalyst.app`, unknown URL 404.
- [ ] `pnpm check:csp https://adanalyst.app` passes (signed out: marketing pages and sign-in).
- [ ] Signed in on the live site, open every app page once and check the browser console for CSP reports.
- [ ] Uptime monitor on `https://adanalyst.app/api/health`.
- [ ] Search Console: verify the domain and submit `https://adanalyst.app/sitemap.xml`.
- [ ] Validate an import with a real Meta Ads export (README "Before Launch" 7).
