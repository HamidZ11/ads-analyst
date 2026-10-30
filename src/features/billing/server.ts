import { cache } from "react";
import { loadSession, type SessionState } from "@/features/workspace/server";
import {
  checkoutConfig,
  enforcementRequested,
  stripeKeyProblem,
  type CheckoutConfig,
} from "./config";
import { importDecision, type BillingRead, type ImportDecision } from "./policy";

export interface BillingContext {
  checkout: CheckoutConfig | null;
  subscription: BillingRead;
  imports: ImportDecision;
}

let warned = false;

/**
 * The signed-in workspace's billing for this request: configuration, the
 * subscription read through RLS, and the import decision. Null in demo mode
 * and when signed out, where there is no workspace to bill.
 */
export async function billingFor(session: SessionState): Promise<BillingContext | null> {
  if (session.kind !== "app" || !session.gateway || session.context.mode !== "supabase")
    return null;
  const problem = stripeKeyProblem();
  if (problem && !warned) {
    warned = true;
    console.error(`[ad-analyst] billing is off: ${problem}`);
  }
  const checkout = checkoutConfig();
  let subscription: BillingRead;
  try {
    subscription = await session.gateway.subscription(session.context.workspace.id);
  } catch (failure) {
    console.error("[ad-analyst] subscription could not be read:", (failure as Error).message);
    subscription = "unavailable";
  }
  return {
    checkout,
    subscription,
    imports: importDecision({
      enforce: enforcementRequested(),
      checkoutConfigured: checkout !== null,
      subscription,
    }),
  };
}

/** For pages: the same, cached for the request. */
export const loadBilling = cache(async () => billingFor(await loadSession()));
