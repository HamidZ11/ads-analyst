import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { proxy } from "../proxy";
import { contentSecurityPolicy, createNonce } from "./csp";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("content security policy", () => {
  it("runs only nonced scripts and what they load, with no inline or foreign scripts", () => {
    const script = directive(contentSecurityPolicy("abc", false), "script-src");
    expect(script).toEqual(["'nonce-abc'", "'strict-dynamic'"]);
    expect(directive(contentSecurityPolicy("abc", true), "script-src")).toContain(
      "'unsafe-eval'",
    );
  });

  it("keeps everything same-origin and forbids framing, plugins and <base>", () => {
    const policy = contentSecurityPolicy("abc", false);
    expect(directive(policy, "default-src")).toEqual(["'self'"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'none'"]);
    expect(policy).not.toMatch(/\*/);
  });

  it("lets billing's form posts redirect to Stripe Checkout and the portal, and nowhere else", () => {
    const policy = contentSecurityPolicy("abc", false);
    expect(directive(policy, "form-action")).toEqual([
      "'self'",
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
    ]);
    const others = policy
      .split(";")
      .filter((d) => !d.trim().startsWith("form-action"))
      .join(";");
    expect(others).not.toMatch(/https?:/);
  });

  it("makes a fresh 128-bit nonce each time", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16);
  });
});

describe("proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sends the same per-request policy to the browser and to the renderer", async () => {
    vi.stubEnv("AD_ANALYST_DEMO_MODE", "true");
    const first = await proxy(new NextRequest("http://localhost/insights"));
    const second = await proxy(new NextRequest("http://localhost/insights"));
    const policy = first.headers.get("Content-Security-Policy")!;
    expect(policy).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    // Next.js reads the nonce from the forwarded request header.
    expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(second.headers.get("Content-Security-Policy")).not.toBe(policy);
  });

  it("puts the policy on redirects and 401s too", async () => {
    vi.stubEnv("AD_ANALYST_DEMO_MODE", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    // Unconfigured: no session can exist, so app pages redirect and APIs refuse.
    const page = await proxy(new NextRequest("http://localhost/insights"));
    const api = await proxy(new NextRequest("http://localhost/api/import"));
    expect(page.status).toBe(307);
    expect(api.status).toBe(401);
    for (const response of [page, api])
      expect(response.headers.get("Content-Security-Policy")).toContain("'strict-dynamic'");
  });
});

describe("shared reports", () => {
  afterEach(() => vi.unstubAllEnvs());
  const path = "/r/hZ0aT8m3Qx1v2Kc9LwP4yB7nR5sD6eF0gH1iJ2kL3mN";

  it("get the same nonce-based policy, signed out, with no redirect to sign-in", async () => {
    vi.stubEnv("AD_ANALYST_DEMO_MODE", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const response = await proxy(new NextRequest(`http://localhost${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    const policy = response.headers.get("Content-Security-Policy")!;
    expect(policy).toMatch(/script-src 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("'unsafe-inline' 'nonce");
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
  });

  it("send no referrer and ask not to be indexed, on top of the site's headers", async () => {
    const rules = await nextConfig.headers!();
    const shared = rules.find((rule) => rule.source === "/r/:token*");
    const headers = Object.fromEntries(shared!.headers.map((h) => [h.key, h.value]));
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(headers).not.toHaveProperty("Content-Security-Policy");
    // Later rules win for the same header, so this one must come after the site's.
    expect(rules.indexOf(shared!)).toBeGreaterThan(
      rules.findIndex((rule) => rule.source === "/:path*"),
    );
  });
});

describe("static security headers", () => {
  it("set HSTS, framing, referrer and permissions policies, and leave the CSP to the proxy", async () => {
    const [rule] = await nextConfig.headers!();
    const headers = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
    expect(rule.source).toBe("/:path*");
    expect(headers).not.toHaveProperty("Content-Security-Policy");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    // Vitest runs with NODE_ENV=test, which is not development.
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
  });
});
