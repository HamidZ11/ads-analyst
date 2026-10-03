import { answerQuestion } from "@/domain/ask/answer";
import { ASK_MAX_QUESTION_LENGTH, type AskContext } from "@/domain/ask/model";
import { askScope, collectAskData } from "@/features/ask/facts";
import { getWorkspace } from "@/features/workspace/server";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Same-origin, read-only analysis. Client IDs and metric values never come from the request. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "Request origin does not match this application." }, 403);
  let body: Record<string, unknown>;
  try {
    // Enforce the byte limit while reading, including chunked requests.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Invalid question payload." }, 400);
    const decoder = new TextDecoder();
    let text = "",
      bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 8192) {
          await reader.cancel();
          return json({ error: "The question payload is too large." }, 413);
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return json({ error: "Invalid question payload." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid question payload." }, 400);
  }
  if (
    typeof body.question !== "string" ||
    !body.question.trim() ||
    body.question.length > ASK_MAX_QUESTION_LENGTH ||
    typeof body.scopeKey !== "string"
  )
    return json({ error: "Provide a question of 1–1000 characters and its scope." }, 400);
  try {
    const workspace = await getWorkspace();
    const scope = askScope(workspace);
    if (body.scopeKey !== scope.key) return json({ error: "scope_changed" }, 409);
    const context: AskContext = { scopeKey: scope.key };
    if (body.context && typeof body.context === "object" && !Array.isArray(body.context)) {
      const supplied = body.context as Record<string, unknown>;
      if (supplied.scopeKey === scope.key) {
        for (const key of ["campaignId", "creativeId"] as const)
          if (typeof supplied[key] === "string" && supplied[key].length < 200)
            context[key] = supplied[key];
        const entity = supplied.previousEntity as Record<string, unknown> | undefined;
        if (
          entity &&
          typeof entity === "object" &&
          typeof entity.id === "string" &&
          entity.id.length < 200 &&
          ["account", "campaign", "creative"].includes(String(entity.type))
        )
          context.previousEntity = {
            id: entity.id,
            type: entity.type as "account" | "campaign" | "creative",
          };
      }
    }
    return json(answerQuestion(body.question.trim(), collectAskData(workspace), context));
  } catch {
    return json({ error: "Unable to analyze this question. Please try again." }, 500);
  }
}
