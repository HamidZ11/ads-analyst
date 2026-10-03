"use server";

import { revalidatePath } from "next/cache";
import { getImportStore } from "@/data/store";
import { updateTargets } from "@/features/import/service";

export interface TargetFormState {
  message: string | null;
  ok: boolean;
}

const toNumber = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : Number(text);
};

/** Saves optional targets for an imported client. Demo clients stay read-only. */
export async function saveClientTargets(
  clientId: string,
  _previous: TargetFormState,
  form: FormData,
): Promise<TargetFormState> {
  const result = updateTargets(getImportStore(), clientId, {
    targetCpa: toNumber(form.get("targetCpa")),
    targetRoas: toNumber(form.get("targetRoas")),
  });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Targets saved." };
}
