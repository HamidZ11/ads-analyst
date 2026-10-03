import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { appMode } from "@/lib/supabase/config";
import { supabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["magiclink", "email", "signup", "invite"];

/**
 * Where the emailed sign-in link lands. Accepts the PKCE code (default email
 * template) or a token hash (custom template), sets the session cookie, then
 * opens the app. A used or expired link returns to sign-in with a message.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = appMode();
  const fail = NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
  if (mode.kind !== "supabase") return fail;
  const db = await supabaseServerClient(mode.url, mode.publishableKey);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  let ok = false;
  if (code) ok = !(await db.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type && OTP_TYPES.includes(type))
    ok = !(await db.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  if (!ok) return fail;
  const response = NextResponse.redirect(new URL("/", url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
