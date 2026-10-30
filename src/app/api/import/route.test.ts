import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceGateway } from "@/data/supabase/gateway";
import { loadSession, type SessionState } from "@/features/workspace/server";
import { POST } from "./route";

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

const session = {
  kind: "app",
  gateway,
  context: { canImport: true, clients: [], workspace: { id: "ws", name: "Ws" } },
} as unknown as SessionState;

const request = (body: string, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/import", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadSession).mockResolvedValue(session);
  gateway.consumeRateLimit.mockResolvedValue(true);
});

describe("import endpoint limits", () => {
  it("asks signed-out callers to sign in without touching the allowance", async () => {
    vi.mocked(loadSession).mockResolvedValue({ kind: "signed_out" });
    expect((await POST(request("{}"))).status).toBe(401);
    expect(gateway.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("refuses a foreign origin before anything else", async () => {
    expect((await POST(request("{}", "https://foreign.example"))).status).toBe(403);
    expect(gateway.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("refuses once the hourly allowance is spent, before reading the file", async () => {
    gateway.consumeRateLimit.mockResolvedValue(false);
    const response = await POST(request("x".repeat(17 * 1024 * 1024)));
    expect(response.status).toBe(429);
    expect((await response.json()).message).toMatch(/import limit/);
    expect(gateway.consumeRateLimit).toHaveBeenCalledWith("import");
    expect(gateway.importMetaCsv).not.toHaveBeenCalled();
  });

  it("fails closed when the allowance can't be checked", async () => {
    gateway.consumeRateLimit.mockRejectedValue(new Error("down"));
    expect((await POST(request("{}"))).status).toBe(503);
    expect(gateway.importMetaCsv).not.toHaveBeenCalled();
  });

  it("still validates the payload once allowed", async () => {
    expect((await POST(request("not json"))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ csv: 1 })))).status).toBe(400);
    expect(gateway.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(gateway.importMetaCsv).not.toHaveBeenCalled();
  });
});

describe("import endpoint billing gate (D-088)", () => {
  const billed = {
    ...(session as { context: object }),
    context: { ...(session as { context: object }).context, mode: "supabase" },
  } as unknown as SessionState;
  const configure = (enforce: boolean) => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_51Abc");
    vi.stubEnv("STRIPE_PRICE_AGENCY_MONTHLY", "price_M");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://adanalyst.example");
    vi.stubEnv("BILLING_ENFORCE", enforce ? "true" : "");
  };

  beforeEach(() => vi.mocked(loadSession).mockResolvedValue(billed));
  afterEach(() => vi.unstubAllEnvs());

  it("lets a workspace without a subscription import while enforcement is off", async () => {
    configure(false);
    gateway.subscription.mockResolvedValue(null);
    gateway.consumeRateLimit.mockResolvedValue(false);
    expect((await POST(request("{}"))).status).toBe(429);
    expect(gateway.consumeRateLimit).toHaveBeenCalled();
  });

  it("refuses a workspace without an active subscription when enforcement is on, before spending anything", async () => {
    configure(true);
    for (const value of [null, { status: "past_due" }, { status: "canceled" }]) {
      gateway.subscription.mockResolvedValue(value);
      const response = await POST(request("{}"));
      expect(response.status).toBe(402);
      expect((await response.json()).message).toMatch(/stays readable/);
    }
    expect(gateway.consumeRateLimit).not.toHaveBeenCalled();
    expect(gateway.importMetaCsv).not.toHaveBeenCalled();
  });

  it("lets an active or trialing workspace through when enforcement is on", async () => {
    configure(true);
    gateway.consumeRateLimit.mockResolvedValue(false);
    for (const status of ["active", "trialing"]) {
      gateway.subscription.mockResolvedValue({ status });
      expect((await POST(request("{}"))).status).toBe(429);
    }
  });

  it("fails closed when the subscription can't be read under enforcement", async () => {
    configure(true);
    gateway.subscription.mockRejectedValue(new Error("down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request("{}"))).status).toBe(503);
    quiet.mockRestore();
    expect(gateway.consumeRateLimit).not.toHaveBeenCalled();
  });
});
