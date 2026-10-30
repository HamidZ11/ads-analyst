import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceGateway } from "@/data/supabase/gateway";
import { renameWorkspace } from "@/features/settings/actions";
import { loadSession, type SessionState } from "@/features/workspace/server";
import { saveReportNote } from "./actions";

vi.mock("@/features/workspace/server", () => ({ loadSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const gateway = {
  ensureWorkspaces: vi.fn(),
  snapshot: vi.fn(),
  importMetaCsv: vi.fn(),
  updateTargets: vi.fn(),
  renameWorkspace: vi.fn(),
  reportNote: vi.fn(),
  saveReportNote: vi.fn(),
  consumeRateLimit: vi.fn(),
  subscription: vi.fn(),
} satisfies WorkspaceGateway;

const signedIn = {
  kind: "app",
  gateway,
  context: { clients: [{ id: "client-a" }], workspace: { id: "ws-a", name: "Agency A" } },
} as unknown as SessionState;
const demo = { ...signedIn, gateway: null } as SessionState;

const IDLE = { ok: false, message: null };
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const save = (clientId: string, start: string, end: string, note: string) =>
  saveReportNote(clientId, start, end, IDLE, form({ note }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadSession).mockResolvedValue(signedIn);
  gateway.saveReportNote.mockResolvedValue(true);
  gateway.renameWorkspace.mockResolvedValue(true);
});

describe("saving the report note", () => {
  it("saves the trimmed note for the client and period", async () => {
    expect(
      await save("client-a", "2026-09-27", "2026-10-03", "  Next: refresh creative. "),
    ).toEqual({
      ok: true,
      message: "Note saved.",
    });
    expect(gateway.saveReportNote).toHaveBeenCalledWith(
      "client-a",
      "2026-09-27",
      "2026-10-03",
      "Next: refresh creative.",
    );
  });

  it("clears the note when it is emptied", async () => {
    expect(await save("client-a", "2026-09-27", "2026-10-03", "   ")).toEqual({
      ok: true,
      message: "Note cleared.",
    });
    expect(gateway.saveReportNote).toHaveBeenCalledWith(
      "client-a",
      "2026-09-27",
      "2026-10-03",
      "",
    );
  });

  it("stores nothing in the demo or signed out", async () => {
    vi.mocked(loadSession).mockResolvedValue(demo);
    expect((await save("client-a", "2026-09-27", "2026-10-03", "x")).ok).toBe(false);
    vi.mocked(loadSession).mockResolvedValue({ kind: "signed_out" });
    expect((await save("client-a", "2026-09-27", "2026-10-03", "x")).ok).toBe(false);
    expect(gateway.saveReportNote).not.toHaveBeenCalled();
  });

  it("refuses a client outside the workspace before reaching the database", async () => {
    const result = await save("client-elsewhere", "2026-09-27", "2026-10-03", "x");
    expect(result).toEqual({ ok: false, message: "That client isn't available." });
    expect(gateway.saveReportNote).not.toHaveBeenCalled();
  });

  it("refuses malformed periods and overlong notes", async () => {
    for (const [start, end] of [
      ["2026-10-03", "2026-09-27"],
      ["yesterday", "2026-10-03"],
      ["2026-02-30", "2026-03-01"],
    ])
      expect((await save("client-a", start, end, "x")).ok).toBe(false);
    expect((await save("client-a", "2026-09-27", "2026-10-03", "x".repeat(4001))).ok).toBe(
      false,
    );
    expect(gateway.saveReportNote).not.toHaveBeenCalled();
  });

  it("reports a refusal or a failure from the database without details", async () => {
    gateway.saveReportNote.mockResolvedValueOnce(false);
    expect((await save("client-a", "2026-09-27", "2026-10-03", "x")).message).toBe(
      "That client isn't available.",
    );
    gateway.saveReportNote.mockRejectedValueOnce(new Error("relation does not exist"));
    expect((await save("client-a", "2026-09-27", "2026-10-03", "x")).message).toBe(
      "The note couldn't be saved. Try again.",
    );
  });
});

describe("renaming the workspace", () => {
  it("renames the caller's own workspace only", async () => {
    expect(
      await renameWorkspace(IDLE, form({ workspaceName: " Northfield Digital " })),
    ).toEqual({
      ok: true,
      message: "Workspace name saved.",
    });
    expect(gateway.renameWorkspace).toHaveBeenCalledWith("ws-a", "Northfield Digital");
  });

  it("refuses blank or overlong names, the demo, and non-owners", async () => {
    expect((await renameWorkspace(IDLE, form({ workspaceName: "  " }))).ok).toBe(false);
    expect((await renameWorkspace(IDLE, form({ workspaceName: "x".repeat(121) }))).ok).toBe(
      false,
    );
    expect(gateway.renameWorkspace).not.toHaveBeenCalled();
    gateway.renameWorkspace.mockResolvedValueOnce(false);
    expect((await renameWorkspace(IDLE, form({ workspaceName: "Mine" }))).message).toBe(
      "Only the workspace owner can rename it.",
    );
    vi.mocked(loadSession).mockResolvedValue(demo);
    expect((await renameWorkspace(IDLE, form({ workspaceName: "Mine" }))).ok).toBe(false);
  });
});
