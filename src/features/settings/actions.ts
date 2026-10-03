"use server";

import { revalidatePath } from "next/cache";
import { tracksRevenue } from "@/domain/labels";
import { readTargets } from "@/features/import/service";
import { loadSession } from "@/features/workspace/server";

export interface TargetFormState {
  message: string | null;
  ok: boolean;
}

const toNumber = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : Number(text);
};

/** Saves optional targets for a client in the caller's workspace; demo data is read-only. */
export async function saveClientTargets(
  clientId: string,
  _previous: TargetFormState,
  form: FormData,
): Promise<TargetFormState> {
  const session = await loadSession();
  if (session.kind !== "app" || !session.gateway)
    return { ok: false, message: "Targets can't be saved here." };
  const client = session.context.clients.find((c) => c.id === clientId);
  if (!client) return { ok: false, message: "That client isn't available." };
  const targets = readTargets(
    {
      targetCpa: toNumber(form.get("targetCpa")),
      targetRoas: toNumber(form.get("targetRoas")),
    },
    tracksRevenue(client),
  );
  if (!targets.ok) return { ok: false, message: targets.message };
  try {
    const saved = await session.gateway.updateTargets(
      clientId,
      targets.targetCpa,
      targets.targetRoas,
    );
    if (!saved) return { ok: false, message: "That client isn't available." };
  } catch {
    return { ok: false, message: "Targets couldn't be saved. Try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Targets saved." };
}
