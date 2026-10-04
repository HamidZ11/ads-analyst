import { revalidatePath } from "next/cache";
import { IMPORT_LIMIT_MESSAGE, readImportRequest, runImport } from "@/features/import/service";
import { loadSession } from "@/features/workspace/server";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** A 10 MB CSV inflates when JSON-escaped; anything beyond this is refused while reading. */
const MAX_REQUEST_BYTES = 16 * 1024 * 1024;

/**
 * Same-origin CSV import for the signed-in user's active workspace. The
 * browser previews; this handler re-parses, re-validates and writes once,
 * atomically, through the user's own database session (RLS applies).
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ ok: false, message: "Request origin does not match this application." }, 403);

  const session = await loadSession();
  if (session.kind === "unconfigured" || session.kind === "signed_out")
    return json({ ok: false, message: "Sign in to import data." }, 401);
  if (session.kind === "unavailable")
    return json(
      {
        ok: false,
        message: "Your workspace couldn't be loaded. Nothing was imported; try again.",
      },
      503,
    );
  const { context, gateway } = session;
  if (!gateway || !context.canImport)
    return json(
      {
        ok: false,
        message: "Imports need a connected database; this deployment runs read-only demo data.",
      },
      503,
    );

  // Spend the user's allowance before reading or parsing anything, so
  // repeated large requests are refused cheaply. Fails closed.
  let allowed: boolean;
  try {
    allowed = await gateway.consumeRateLimit("import");
  } catch {
    return json(
      {
        ok: false,
        message: "The database couldn't be reached. Nothing was imported; try again.",
      },
      503,
    );
  }
  if (!allowed) return json({ ok: false, message: IMPORT_LIMIT_MESSAGE }, 429);

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

  const outcome = await runImport(
    parsed,
    {
      now: new Date(),
      clients: context.clients,
      accountIdFor: (clientId) =>
        context.repository.listAdAccounts(clientId)[0]?.externalId || null,
    },
    (payload) => gateway.importMetaCsv(context.workspace.id, payload),
  );
  if (!outcome.ok) return json(outcome, outcome.status);
  revalidatePath("/", "layout");
  return json(outcome);
}
