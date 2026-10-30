import { supabaseBillingWriter } from "@/data/supabase/billing";
import { stripeKeyProblem, webhookConfig } from "@/features/billing/config";
import { stripeClient } from "@/features/billing/stripe";
import { handleStripeWebhook } from "@/features/billing/webhook";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Stripe's webhook endpoint (D-083). Public (Stripe has no session); the
 * signature over the raw body is the authentication, and the database write
 * needs the webhook's own secret. Unconfigured, it answers 503 so Stripe
 * keeps the events and retries them once billing is set up.
 */
export async function POST(request: Request) {
  const config = webhookConfig();
  if (!config) {
    const problem = stripeKeyProblem();
    console.error(
      `[ad-analyst] billing webhook is not configured${problem ? `: ${problem}` : "."}`,
    );
    return json({ received: false, message: "Billing is not configured." }, 503);
  }
  // The exact bytes Stripe signed: read as text, never parsed first.
  const rawBody = await request.text();
  const result = await handleStripeWebhook({
    rawBody,
    signature: request.headers.get("stripe-signature"),
    signingSecret: config.signingSecret,
    live: config.secretKey.startsWith("sk_live_"),
    prices: config.prices,
    stripe: stripeClient(config.secretKey),
    writer: supabaseBillingWriter(config.supabaseUrl, config.publishableKey, config.dbSecret),
  });
  return json(result.body, result.status);
}
