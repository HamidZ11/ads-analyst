import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { comparisonLabel, periodPairForPreset } from "@/domain/periods";
import { askScope } from "@/features/ask/facts";
import { getWorkspace, type Workspace } from "@/features/workspace/server";
import { POST } from "./route";

vi.mock("@/features/workspace/server", () => ({ getWorkspace: vi.fn() }));
const repo = new InMemoryRepository(buildSeedDataset({ anchorDate: "2026-10-03" }));
const client = repo.getClient("cli_luxe")!;
const periods = periodPairForPreset("7d", "2026-10-03");
const workspace: Workspace = {
  repository: repo,
  agency: repo.getAgency(),
  clients: repo.listClients(),
  client,
  adAccount: repo.listAdAccounts(client.id)[0],
  coverage: repo.getCoverage(client.id),
  dataSource: repo.getDataSource(client.id),
  mode: "demo",
  user: null,
  workspace: { id: repo.getAgency().id, name: repo.getAgency().name },
  canImport: false,
  today: "2026-10-03",
  preset: "7d",
  periods,
  comparison: comparisonLabel(periods),
};
const scope = askScope(workspace);
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/ask", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.mocked(getWorkspace).mockResolvedValue(workspace);
});

describe("read-only Ask endpoint", () => {
  it.each([
    null,
    [],
    {},
    { question: " " },
    { question: "x".repeat(1001), scopeKey: scope.key },
  ])("validates malformed question payloads", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
  });
  it("rejects oversized payloads", async () => {
    expect((await POST(request({ question: "x".repeat(9000) }))).status).toBe(413);
  });
  it("rejects a foreign origin", async () => {
    expect(
      (
        await POST(
          request({ question: "CPA?", scopeKey: scope.key }, "https://foreign.example"),
        )
      ).status,
    ).toBe(403);
  });
  it("rejects stale scope instead of returning different client/date facts", async () => {
    expect((await POST(request({ question: "CPA?", scopeKey: "foreign-client" }))).status).toBe(
      409,
    );
  });
  it("uses server scope and ignores request metrics/client IDs and foreign entity context", async () => {
    const response = await POST(
      request({
        question: "Show creatives in that campaign",
        scopeKey: scope.key,
        clientId: "cli_arc",
        metrics: { spend: 99 },
        context: {
          scopeKey: scope.key,
          campaignId: "cmp_arc_01",
          previousEntity: { type: "campaign", id: "cmp_arc_01" },
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const result = await response.json();
    expect(result.answer.scope.clientId).toBe("cli_luxe");
    expect(result.answer.state).toBe("clarification");
    expect(result.context.campaignId).toBeUndefined();
  });
  it("returns structured unsupported answers without a service call", async () => {
    const response = await POST(
      request({ question: "Forecast next week", scopeKey: scope.key }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).answer.state).toBe("unsupported");
  });
  it("returns a generic recoverable error without exposing internals", async () => {
    vi.mocked(getWorkspace).mockRejectedValueOnce(new Error("private implementation detail"));
    const response = await POST(request({ question: "CPA?", scopeKey: scope.key }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private implementation");
  });
});
