"use server";

import { revalidatePath } from "next/cache";
import { loadSession } from "@/features/workspace/server";
import {
  isSharePreset,
  newShareToken,
  SHARE_EXPIRY_DAYS,
  sharedPeriods,
  sharePath,
} from "./share";

export interface ShareFormState {
  ok: boolean;
  message: string | null;
  /** `/r/<token>`, returned once, right after the link is made. */
  path: string | null;
  expiresAt: string | null;
}

export interface RevokeState {
  ok: boolean;
  message: string | null;
}

const refused = (message: string): ShareFormState => ({
  ok: false,
  message,
  path: null,
  expiresAt: null,
});

/**
 * Creates a read-only link to one client's report for one period. The
 * workspace's owner only; the database checks ownership again
 * (create_report_share_link) and stores only the token's hash, so the path
 * returned here is the only copy.
 */
export async function createShareLink(
  clientId: string,
  preset: string,
  periodStart: string,
  periodEnd: string,
  _previous: ShareFormState,
  form: FormData,
): Promise<ShareFormState> {
  const session = await loadSession();
  if (session.kind !== "app" || !session.gateway)
    return refused("Share links need a signed-in workspace.");
  if (session.role !== "owner")
    return refused("Only the workspace owner can create share links.");
  if (!session.context.clients.some((c) => c.id === clientId))
    return refused("That client isn't available.");
  if (!isSharePreset(preset) || !sharedPeriods(preset, periodStart, periodEnd))
    return refused("That reporting period can't be shared.");
  const days = Number(form.get("days"));
  if (!(SHARE_EXPIRY_DAYS as readonly number[]).includes(days))
    return refused("Choose when the link expires.");
  const token = newShareToken();
  try {
    const created = await session.gateway.createShareLink({
      clientId,
      token,
      preset,
      periodStart,
      periodEnd,
      days,
    });
    if (!created) return refused("That client isn't available.");
    revalidatePath("/report");
    revalidatePath("/settings");
    return {
      ok: true,
      message: "Link created.",
      path: sharePath(token),
      expiresAt: created.expiresAt,
    };
  } catch {
    return refused("The link couldn't be created. Try again.");
  }
}

/** Revokes a link at once; it then shows "This link has expired". Any member. */
export async function revokeShareLink(linkId: string): Promise<RevokeState> {
  const session = await loadSession();
  if (session.kind !== "app" || !session.gateway)
    return { ok: false, message: "Share links need a signed-in workspace." };
  try {
    const revoked = await session.gateway.revokeShareLink(linkId);
    if (!revoked) return { ok: false, message: "That link isn't available." };
  } catch {
    return { ok: false, message: "The link couldn't be revoked. Try again." };
  }
  revalidatePath("/report");
  revalidatePath("/settings");
  return { ok: true, message: "Link revoked." };
}
