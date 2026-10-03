"use server";

import { cookies } from "next/headers";
import { parseDatePreset } from "@/domain/periods";
import { CLIENT_COOKIE, COOKIE_MAX_AGE_SECONDS, RANGE_COOKIE } from "./cookies";
import { loadSession } from "./server";

const cookieOptions = {
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
  sameSite: "lax" as const,
  httpOnly: true,
};

/** Switch the active client, only among clients the user can access. */
export async function selectClient(clientId: string): Promise<void> {
  const session = await loadSession();
  if (session.kind !== "app" || !session.context.clients.some((c) => c.id === clientId)) return;
  const store = await cookies();
  store.set(CLIENT_COOKIE, clientId, cookieOptions);
}

/** Switch the active date preset. Unknown values fall back to the default. */
export async function selectDatePreset(preset: string): Promise<void> {
  const store = await cookies();
  store.set(RANGE_COOKIE, parseDatePreset(preset), cookieOptions);
}
