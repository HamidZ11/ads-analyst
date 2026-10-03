import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * A Supabase client for this request, acting as the signed-in user (the
 * publishable key plus the session cookies), so every query is subject to RLS.
 * Created per request; never cached across users.
 */
export async function supabaseServerClient(
  url: string,
  publishableKey: string,
): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the proxy refreshes sessions.
        }
      },
    },
  });
}
