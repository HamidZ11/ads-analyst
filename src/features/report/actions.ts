"use server";

import { revalidatePath } from "next/cache";
import { isIsoDate } from "@/domain/periods";
import { loadSession } from "@/features/workspace/server";
import { NOTE_MAX_LENGTH } from "./note";

/** A real calendar date in ISO form; isIsoDate alone lets "2026-02-30" roll over. */
const calendarDate = (value: string) =>
  isIsoDate(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export interface NoteFormState {
  message: string | null;
  ok: boolean;
}

/**
 * Saves the "What we're doing next" note for one client and reporting period.
 * The client must be in the caller's workspace; the database checks the same
 * again (save_client_report_note). Demo data is read-only.
 */
export async function saveReportNote(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  _previous: NoteFormState,
  form: FormData,
): Promise<NoteFormState> {
  const session = await loadSession();
  if (session.kind !== "app" || !session.gateway)
    return { ok: false, message: "Notes can't be saved in the demo." };
  if (!session.context.clients.some((c) => c.id === clientId))
    return { ok: false, message: "That client isn't available." };
  if (!calendarDate(periodStart) || !calendarDate(periodEnd) || periodEnd < periodStart)
    return { ok: false, message: "That reporting period isn't valid." };
  const raw = form.get("note");
  const body = typeof raw === "string" ? raw.trim() : "";
  if (body.length > NOTE_MAX_LENGTH)
    return {
      ok: false,
      message: `Keep the note under ${NOTE_MAX_LENGTH.toLocaleString("en-GB")} characters.`,
    };
  try {
    const saved = await session.gateway.saveReportNote(clientId, periodStart, periodEnd, body);
    if (!saved) return { ok: false, message: "That client isn't available." };
  } catch {
    return { ok: false, message: "The note couldn't be saved. Try again." };
  }
  revalidatePath("/report");
  return { ok: true, message: body === "" ? "Note cleared." : "Note saved." };
}
