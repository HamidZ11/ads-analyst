"use server";

import { cookies } from "next/headers";
import { getRepository } from "@/data";
import { parseDatePreset } from "@/domain/periods";
import { CLIENT_COOKIE, COOKIE_MAX_AGE_SECONDS, RANGE_COOKIE } from "./cookies";

const cookieOptions = {
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
  sameSite: "lax" as const,
};

/** Switch the active client. Setting the cookie re-renders the current route. */
export async function selectClient(clientId: string): Promise<void> {
  if (!getRepository().getClient(clientId)) return;
  const store = await cookies();
  store.set(CLIENT_COOKIE, clientId, cookieOptions);
}

/** Switch the active date preset. Unknown values fall back to the default. */
export async function selectDatePreset(preset: string): Promise<void> {
  const store = await cookies();
  store.set(RANGE_COOKIE, parseDatePreset(preset), cookieOptions);
}
