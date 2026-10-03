import { revalidatePath } from "next/cache";
import { getRepository } from "@/data";
import { getImportStore } from "@/data/store";
import { readImportRequest, runImport } from "@/features/import/service";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** A 10 MB CSV inflates when JSON-escaped; anything beyond this is refused while reading. */
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

/**
 * Same-origin CSV import. The browser previews; this handler re-parses,
 * re-validates and is the only code that writes imported data.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ ok: false, message: "Request origin does not match this application." }, 403);
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ ok: false, message: "Invalid import payload." }, 400);
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_REQUEST_BYTES) {
          await reader.cancel();
          return json({ ok: false, message: "The file is larger than 10 MB." }, 413);
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, message: "Invalid import payload." }, 400);
  }
  const parsed = readImportRequest(body);
  if (typeof parsed === "string") return json({ ok: false, message: parsed }, 400);
  try {
    const seededClients = getRepository()
      .listClients()
      .filter((c) => getRepository().getDataSource(c.id).kind === "seed");
    const outcome = runImport(parsed, getImportStore(), { now: new Date(), seededClients });
    if (!outcome.ok) return json(outcome, outcome.status);
    revalidatePath("/", "layout");
    return json(outcome);
  } catch {
    return json(
      { ok: false, message: "The import could not be saved. Nothing was changed." },
      500,
    );
  }
}
