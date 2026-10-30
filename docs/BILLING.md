# Billing

Subscription billing with Stripe (D-083). Built and tested in test mode only; going live is configuration, listed at the end. Pricing is fixed by PRODUCT.md: Agency is £99 a month or £990 a year for up to 10 client accounts; Enterprise is custom. There are no trials, discounts or extra plan limits in the code.

## How it fits together

- **Checkout:** Settings → Billing has "Subscribe monthly" / "Subscribe yearly" (one button for each configured price). Each posts to `/api/billing/checkout`, which creates a Checkout Session in subscription mode for the signed-in workspace and answers with a 303 to Stripe. The workspace id travels in `metadata.workspace_id` on the session and on the subscription. Only this server sets it. Success and cancel return to `/settings?billing=success|cancelled#billing` on `NEXT_PUBLIC_SITE_URL`.
- **Customer portal:** "Manage billing" posts to `/api/billing/portal`, which opens Stripe's portal for the workspace's Stripe customer (change card, switch interval, invoices, cancel).
- **Webhook:** `/api/billing/webhook` checks the Stripe signature over the raw body. It then fetches the subscription from Stripe and calls `public.apply_billing_event` in Postgres. That call stores the state and records the event id in one transaction, so a redelivered event does nothing. Events handled: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Any other type gets a 200 and is not stored.
- **Who can write:** the webhook has no user session and the app has no service-role key. It calls the database as `anon` with the publishable key and presents `BILLING_WEBHOOK_DB_SECRET`. `apply_billing_event` refuses every caller that lacks this secret. Members read `workspace_subscriptions` through RLS. Nobody can write that table directly.
- **Who can manage billing:** any member of the workspace can subscribe and open Manage billing (D-NEW-billing-answers-1).
- **Gating:** `BILLING_ENFORCE=true` turns on the single policy in `src/features/billing/policy.ts`. When it's on, a workspace without an `active` or `trialing` subscription can still read every page but cannot import. After a failed payment there is a 7-day grace period: from the first `invoice.payment_failed` of an unpaid episode (stored as `payment_failed_at`, kept through Stripe's retries, cleared once the subscription is active or trialing again), a `past_due` or `unpaid` workspace can still import for 7 days, and Settings → Billing says until when. Gating applies only when Checkout is configured, so a blocked workspace always has a way to subscribe. If the subscription can't be read, imports are refused (fail closed).
- **Pricing page:** when Checkout is configured, Agency's "Subscribe" goes to `/sign-in?next=/settings#billing`: a signed-in visitor passes straight to Settings → Billing, and a signed-out one signs in and returns there (the path is validated as an app page on this site, and carried to the emailed link's callback in a short-lived httpOnly cookie). The payment link is then never shown. Only if Checkout isn't configured does it go to `NEXT_PUBLIC_STRIPE_PAYMENT_LINK`, when that is set (D-065). With neither, the button isn't shown.
- **Client accounts:** the Agency plan's 10 client accounts are not enforced. Settings → Billing shows a soft notice on a live Agency subscription at 10 or more clients, pointing to Enterprise on the pricing page.

## Stripe dashboard setup (test mode)

1. Turn on **Test mode**.
2. **Product catalogue → Add product:** "Ad Analyst Agency", with two recurring prices in GBP: £99 monthly and £990 yearly. Copy both price ids (`price_…`).
3. **Settings → Billing → Customer portal:** activate the test-mode portal. Allow updating payment methods and viewing invoices. Allow cancellation **at the end of the billing period**, which is what the draft terms promise. Allow switching between the two Agency prices; the portal uses Stripe's default proration, which the owner chose (D-NEW-billing-answers-1). The code sets no proration behaviour of its own.
4. **Developers → Webhooks → Add endpoint:** `https://<your domain>/api/billing/webhook`, with exactly these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

   Copy the signing secret (`whsec_…`).

5. **Developers → API keys:** copy the test secret key (`sk_test_…`).
6. Leave tax, coupons, trials and promotion codes off. The code doesn't send any of them.

## Database

Apply the migrations `20261030120000_workspace_billing.sql` and `20261030130000_billing_grace_period.sql` (`supabase db push`). Then generate a long random secret, for example `openssl rand -hex 32`, and store **its hash** once in the Supabase SQL editor:

```sql
insert into public.billing_webhook_secret (secret_hash)
values (sha256(convert_to('<BILLING_WEBHOOK_DB_SECRET>', 'UTF8')))
on conflict (id) do update set secret_hash = excluded.secret_hash, created_at = now();
```

Put the same secret in the app's `BILLING_WEBHOOK_DB_SECRET`. To rotate it, run the statement with a new value and update the variable. Until the hash is stored, the webhook gets "not allowed" and answers 500, and Stripe keeps retrying for up to three days.

## Environment

All server-only except the existing `NEXT_PUBLIC_` values. Placeholders only. Never commit real keys.

```bash
# Stripe (test mode). The key must start with sk_test_ unless NODE_ENV=production
# and BILLING_LIVE=true; anything else switches billing off.
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_PRICE_AGENCY_MONTHLY=price_replace_me_monthly
STRIPE_PRICE_AGENCY_YEARLY=price_replace_me_yearly
STRIPE_WEBHOOK_SECRET=whsec_replace_me
# 32+ random characters; its SHA-256 hash is stored in public.billing_webhook_secret.
BILLING_WEBHOOK_DB_SECRET=replace_me_with_at_least_32_random_characters
# Import gating: off unless exactly "true".
BILLING_ENFORCE=false
# Live charges: only honoured in a production build, and only when exactly "true".
BILLING_LIVE=false
```

Billing also uses the existing `NEXT_PUBLIC_SITE_URL` (return URLs), `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the webhook's database connection), and optionally `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` (pricing fallback).

What turns on what:

| Feature                                   | Needs                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Subscribe buttons, Manage billing, gating | an allowed secret key, `NEXT_PUBLIC_SITE_URL`, at least one price id                                              |
| Webhook                                   | the above key, `STRIPE_WEBHOOK_SECRET`, `BILLING_WEBHOOK_DB_SECRET` (32+ chars), Supabase URL and publishable key |
| Import gating                             | Checkout configured and `BILLING_ENFORCE=true`                                                                    |

The server-only variables are read on each request, by the pricing page, Settings and the routes alike. The `NEXT_PUBLIC_` values are inlined at build time (D-062), so changing them needs a rebuild.

## Testing locally with the Stripe CLI

You need a Supabase project with the migration applied, and the secret hash stored as described above. Use a test or local project, never production.

1. Set the variables in `.env.local` with test values and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, then run `pnpm dev`.
2. `stripe login`, then forward events:

   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook \
     --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed
   ```

   Put the `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET` and restart the dev server.

3. Sign in, open Settings → Billing and press **Subscribe monthly**. Pay with `4242 4242 4242 4242`, any future date and any CVC. On return, the section shows "Agency · monthly", "Active" and the renewal date once the events arrive. The `stripe listen` output shows 200s.
4. **Manage billing:** cancel at period end, and the status line reads "Ends …". Switch interval, and the plan line follows.
5. **Payment failure:** in the portal, change the card to `4000 0000 0000 0341` (it attaches but every charge fails). Then advance the subscription with a test clock, or run `stripe trigger invoice.payment_failed`. Settings shows "Payment overdue".
6. **Idempotency:** `stripe events resend <evt_id>` returns 200 with `"outcome":"duplicate"`.
7. **Gating:** set `BILLING_ENFORCE=true` and restart. A workspace without an active subscription sees "Imports need an active subscription" on the import page, and `/api/import` answers 402. Every other page still works. After a payment failure (step 5), imports keep working and Settings says "Imports continue until …", 7 days after the first failure.

`stripe trigger checkout.session.completed` creates fixtures without our workspace metadata, so the database records them as `unlinked` and writes nothing. That is expected. Use the Subscribe button for the real flow.

Automated tests need none of this. They use a fake Stripe client, Stripe's offline signature helper and PGlite (`pnpm test`).

## Going live checklist

1. The open questions in D-083 are decided (D-NEW-billing-answers-1). What remains is when to turn on gating.
2. Legal: finish the terms' billing, cancellation and refund wording and VAT (D-064). Check that the portal's cancellation setting matches the terms.
3. In **live mode**, recreate the product, both prices, the customer portal settings and the webhook endpoint with the same five events.
4. Production environment: set `STRIPE_SECRET_KEY=sk_live_…`, the live price ids, the live `whsec_…`, `BILLING_LIVE=true`, and a **new** `BILLING_WEBHOOK_DB_SECRET` with its hash stored in the production database. `NODE_ENV` is `production` in a production build.
5. Deploy. A rebuild is needed only if a `NEXT_PUBLIC_` value changed.
6. Smoke test with a real card on the monthly price: Checkout, webhook 200s in the Stripe dashboard, Settings showing Active, portal cancel. Then refund and cancel it in the dashboard.
7. Only then, if wanted, set `BILLING_ENFORCE=true` and redeploy.
8. `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` is ignored while Checkout is configured, so it can stay set as the fallback or be removed.
9. Watch **Developers → Webhooks** for failed deliveries. Rows in `billing_events` with outcome `unlinked`, `conflict` or `stale` need a look. The server log also names them.
