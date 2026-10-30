import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceGateway } from "@/data/supabase/gateway";
import { loadSession, type SessionState } from "@/features/workspace/server";
import { SHARE_TOKEN } from "./share";
import { createShareLink, revokeShareLink } from "./share-actions";

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
  createShareLink: vi.fn(),
  shareLinks: vi.fn(),
  revokeShareLink: vi.fn(),
} satisfies WorkspaceGateway;

const owner = {
  kind: "app",
  gateway,
  role: "owner",
  context: { clients: [{ id: "client-a" }], workspace: { id: "ws-a", name: "Agency A" } },
} as unknown as SessionState;
const member = { ...owner, role: "member" } as SessionState;
const demo = { ...owner, gateway: null, role: null } as SessionState;

const IDLE = { ok: false, message: null, path: null, expiresAt: null };
const days = (value: string) => {
  const data = new FormData();
  data.set("days", value);
  return data;
};
const create = (
  clientId = "client-a",
  preset = "7d",
  start = "2026-09-21",
  end = "2026-09-27",
  d = "30",
) => createShareLink(clientId, preset, start, end, IDLE, days(d));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadSession).mockResolvedValue(owner);
  gateway.createShareLink.mockResolvedValue({
    id: "link-1",
    expiresAt: "2026-11-29T10:00:00.000Z",
  });
  gateway.revokeShareLink.mockResolvedValue(true);
});

describe("creating a share link", () => {
  it("makes a fresh token, hands it to the database once and returns its path", async () => {
    const result = await create();
    expect(result.ok).toBe(true);
    const sent = gateway.createShareLink.mock.calls[0][0];
    expect(sent).toMatchObject({
      clientId: "client-a",
      preset: "7d",
      periodStart: "2026-09-21",
      periodEnd: "2026-09-27",
      days: 30,
    });
    expect(sent.token).toMatch(SHARE_TOKEN);
    expect(result.path).toBe(`/r/${sent.token}`);
    expect(result.expiresAt).toBe("2026-11-29T10:00:00.000Z");
    await create();
    expect(gateway.createShareLink.mock.calls[1][0].token).not.toBe(sent.token);
  });

  it("offers 7, 30 or 90 days and nothing else", async () => {
    for (const d of ["7", "90"])
      expect((await create(undefined, undefined, undefined, undefined, d)).ok).toBe(true);
    for (const d of ["0", "31", "365", "", "abc"])
      expect((await create(undefined, undefined, undefined, undefined, d)).ok, d).toBe(false);
    expect(gateway.createShareLink).toHaveBeenCalledTimes(2);
  });

  it("is the owner's, in a signed-in workspace, for one of its clients", async () => {
    vi.mocked(loadSession).mockResolvedValue(member);
    expect(await create()).toMatchObject({
      ok: false,
      message: "Only the workspace owner can create share links.",
    });
    vi.mocked(loadSession).mockResolvedValue(demo);
    expect((await create()).ok).toBe(false);
    vi.mocked(loadSession).mockResolvedValue({ kind: "signed_out" });
    expect((await create()).ok).toBe(false);
    vi.mocked(loadSession).mockResolvedValue(owner);
    expect(await create("client-b")).toMatchObject({ ok: false, path: null });
    expect(gateway.createShareLink).not.toHaveBeenCalled();
  });

  it("refuses periods that aren't a preset's dates", async () => {
    for (const [preset, start, end] of [
      ["custom", "2026-09-21", "2026-09-27"],
      ["7d", "2026-09-22", "2026-09-27"],
      ["today", "2026-09-21", "2026-09-27"],
      ["7d", "2026-09-21", "not-a-date"],
    ])
      expect((await create("client-a", preset, start, end)).ok, preset).toBe(false);
    expect(gateway.createShareLink).not.toHaveBeenCalled();
  });

  it("returns no path when the database refuses or fails", async () => {
    gateway.createShareLink.mockResolvedValueOnce(null);
    expect(await create()).toMatchObject({ ok: false, path: null });
    gateway.createShareLink.mockRejectedValueOnce(new Error("down"));
    expect(await create()).toMatchObject({
      ok: false,
      path: null,
      message: "The link couldn't be created. Try again.",
    });
  });
});

describe("revoking a share link", () => {
  it("revokes for any member, and says so when the link isn't theirs or fails", async () => {
    vi.mocked(loadSession).mockResolvedValue(member);
    expect(await revokeShareLink("link-1")).toEqual({ ok: true, message: "Link revoked." });
    expect(gateway.revokeShareLink).toHaveBeenCalledWith("link-1");
    gateway.revokeShareLink.mockResolvedValueOnce(false);
    expect((await revokeShareLink("link-2")).ok).toBe(false);
    gateway.revokeShareLink.mockRejectedValueOnce(new Error("down"));
    expect((await revokeShareLink("link-3")).ok).toBe(false);
    vi.mocked(loadSession).mockResolvedValue(demo);
    expect((await revokeShareLink("link-4")).ok).toBe(false);
  });
});
