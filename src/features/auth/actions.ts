"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { appMode, signupsAllowed } from "@/lib/supabase/config";
import { supabaseServerClient } from "@/lib/supabase/server";
import { CLIENT_COOKIE, WORKSPACE_COOKIE } from "@/features/workspace/cookies";
import { signInFailureMessage, validEmail } from "./messages";

export interface SignInState {
  status: "idle" | "sent" | "error";
  message: string | null;
  email: string;
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Emails a one-time sign-in link (Supabase magic link, PKCE). The answer is
 * the same whether or not the address has an account, so the form cannot be
 * used to discover users.
 */
export async function requestSignInLink(
  _previous: SignInState,
  form: FormData,
): Promise<SignInState> {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!validEmail(email))
    return { status: "error", message: "Enter a valid email address.", email };
  const mode = appMode();
  if (mode.kind !== "supabase")
    return { status: "error", message: "Sign-in isn't configured for this deployment.", email };
  const db = await supabaseServerClient(mode.url, mode.publishableKey);
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
      shouldCreateUser: signupsAllowed(),
    },
  });
  if (error) {
    const message = signInFailureMessage(error);
    if (message) {
      console.error("[ad-analyst] sign-in link failed:", error.message);
      return { status: "error", message, email };
    }
  }
  return { status: "sent", message: null, email };
}

export async function signOut(): Promise<void> {
  const mode = appMode();
  if (mode.kind === "supabase") {
    const db = await supabaseServerClient(mode.url, mode.publishableKey);
    await db.auth.signOut();
  }
  const store = await cookies();
  store.delete(CLIENT_COOKIE);
  store.delete(WORKSPACE_COOKIE);
  redirect("/sign-in");
}
