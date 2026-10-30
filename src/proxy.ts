import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { accessDecision } from "@/features/auth/access";
import { contentSecurityPolicy, createNonce } from "@/lib/csp";
import { APP_HOME } from "@/lib/routes";
import { appMode, sessionCookieOptions } from "@/lib/supabase/config";

/**
 * Runs before every page and API route: sets this request's Content Security
 * Policy and nonce, refreshes the Supabase session cookie and turns away
 * signed-out requests (pages go to /sign-in, APIs get 401). An optimistic
 * check only; the data access layer and RLS decide access.
 */
export async function proxy(request: NextRequest) {
  const csp = contentSecurityPolicy(createNonce(), process.env.NODE_ENV === "development");
  // Next.js reads the nonce from the policy on the request and adds it to
  // its scripts; the browser enforces the policy on the response.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };
  const secured = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  const mode = appMode();
  if (mode.kind === "demo") return secured(forward());

  let response = forward();
  let signedIn = false;
  if (mode.kind === "supabase") {
    const db = createServerClient(mode.url, mode.publishableKey, {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = forward();
          for (const { name, value, options } of list)
            response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {}))
            response.headers.set(key, value);
        },
      },
    });
    const { data } = await db.auth.getClaims();
    signedIn = typeof data?.claims?.sub === "string";
  }

  const decision = accessDecision(request.nextUrl.pathname, signedIn);
  if (decision === "allow") return secured(response);
  const carryCookies = (next: NextResponse) => {
    for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
    next.headers.set("Cache-Control", "private, no-store");
    return secured(next);
  };
  if (decision === "unauthorized")
    return carryCookies(
      NextResponse.json({ ok: false, message: "Sign in to continue." }, { status: 401 }),
    );
  if (decision === "redirect_app")
    return carryCookies(NextResponse.redirect(new URL(APP_HOME, request.url)));
  const target = new URL("/sign-in", request.url);
  return carryCookies(NextResponse.redirect(target));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
