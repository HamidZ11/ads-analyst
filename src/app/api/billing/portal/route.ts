import { portalRedirect } from "@/features/billing/checkout";
import { billingFor } from "@/features/billing/server";
import { stripeClient } from "@/features/billing/stripe";
import { loadSession } from "@/features/workspace/server";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Opens Stripe's customer portal for the signed-in workspace's customer, to
 * change the card, switch interval, see invoices or cancel. A form post from
 * Settings, answered with a 303.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ ok: false, message: "Request origin does not match this application." }, 403);

  const session = await loadSession();
  if (session.kind !== "app")
    return json({ ok: false, message: "Sign in to manage billing." }, 401);
  const billing = await billingFor(session);
  if (!billing || billing.subscription === "unavailable")
    return Response.redirect(
      new URL("/settings?billing=unavailable#billing", request.url),
      303,
    );

  const target = await portalRedirect({
    config: billing.checkout,
    stripe: stripeClient,
    subscription: billing.subscription,
  });
  return Response.redirect(new URL(target, request.url), 303);
}
