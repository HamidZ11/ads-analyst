import { describe, expect, it } from "vitest";
import { accessDecision } from "@/features/auth/access";
import { healthReport } from "@/lib/health";

const SUPABASE = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_secretish",
};

describe("/api/health", () => {
  it("is healthy in Supabase and demo deployments and names the mode", () => {
    expect(healthReport(SUPABASE)).toEqual({
      status: 200,
      body: { ok: true, mode: "supabase", demoFlagIgnored: false, commit: null },
    });
    expect(
      healthReport({ NODE_ENV: "production", AD_ANALYST_DEMO_MODE: "true" }).body,
    ).toMatchObject({ ok: true, mode: "demo" });
  });

  it("flags a demo flag that Supabase variables override", () => {
    expect(healthReport({ ...SUPABASE, AD_ANALYST_DEMO_MODE: "true" }).body).toMatchObject({
      mode: "supabase",
      demoFlagIgnored: true,
    });
  });

  it("fails an unconfigured production build with 503", () => {
    expect(healthReport({ NODE_ENV: "production" })).toMatchObject({
      status: 503,
      body: { ok: false, mode: "unconfigured" },
    });
  });

  it("reports the short commit and never a configuration value", () => {
    const report = healthReport({ ...SUPABASE, VERCEL_GIT_COMMIT_SHA: "abcdef1234567890" });
    expect(report.body.commit).toBe("abcdef1");
    const text = JSON.stringify(report);
    expect(text).not.toContain("x.supabase.co");
    expect(text).not.toContain("secretish");
  });

  it("answers signed-out uptime checks", () => {
    expect(accessDecision("/api/health", false)).toBe("allow");
    expect(accessDecision("/api/healthz", false)).toBe("unauthorized");
  });
});
