import { checkoutRedirect } from "@/features/billing/checkout";
import { billingFor } from "@/features/billing/server";
import { isInterval, stripeClient } from "@/features/billing/stripe";
import { loadSession } from "@/features/workspace/server";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Starts Stripe Checkout for the signed-in workspace: a form post from
 * Settings with `interval` (month or year), answered with a 303 to Stripe's
 * page, or back to Settings with a notice.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ ok: false, message: "Request origin does not match this application." }, 403);

  const session = await loadSession();
  if (session.kind !== "app") return json({ ok: false, message: "Sign in to subscribe." }, 401);
  const billing = await billingFor(session);
  const form = await request.formData().catch(() => null);
  const interval = form?.get("interval");
  if (!billing || !isInterval(interval) || billing.subscription === "unavailable")
    return Response.redirect(
      new URL("/settings?billing=unavailable#billing", request.url),
      303,
    );

  const target = await checkoutRedirect({
    config: billing.checkout,
    stripe: stripeClient,
    interval,
    workspaceId: session.context.workspace.id,
    email: session.context.user?.email ?? null,
    subscription: billing.subscription,
  });
  return Response.redirect(new URL(target, request.url), 303);
}
