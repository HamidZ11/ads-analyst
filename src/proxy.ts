import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { accessDecision } from "@/features/auth/access";
import { APP_HOME } from "@/lib/routes";
import { appMode, sessionCookieOptions } from "@/lib/supabase/config";

/**
 * Runs before every page and API route: refreshes the Supabase session cookie
 * and turns away signed-out requests (pages go to /sign-in, APIs get 401).
 * An optimistic check only; the data access layer and RLS decide access.
 */
export async function proxy(request: NextRequest) {
  const mode = appMode();
  if (mode.kind === "demo") return NextResponse.next();

  let response = NextResponse.next({ request });
  let signedIn = false;
  if (mode.kind === "supabase") {
    const db = createServerClient(mode.url, mode.publishableKey, {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
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
  if (decision === "allow") return response;
  const carryCookies = (next: NextResponse) => {
    for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
    next.headers.set("Cache-Control", "private, no-store");
    return next;
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
