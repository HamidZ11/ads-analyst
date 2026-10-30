// Smoke check of a running deployment (D-NEW-launch-deploy).
//
// Usage: pnpm check:deploy <origin> <supabase|demo>
//   e.g. pnpm check:deploy https://adanalyst.app supabase
//        pnpm check:deploy http://localhost:3000 demo
//
// Plain HTTP requests only, no browser and no sign-in. Checks that
// /api/health answers in the expected mode, that pages carry the security
// headers and a nonce-based policy, that the app is gated (Supabase) or open
// (demo), and that robots.txt and the sitemap name this origin. Over HTTPS it
// also requires HSTS.

const [origin = "", expected = ""] = process.argv.slice(2).map((a) => a.replace(/\/$/, ""));
if (!/^https?:\/\//.test(origin) || !["supabase", "demo"].includes(expected)) {
  console.error("Usage: pnpm check:deploy <origin> <supabase|demo>");
  process.exit(2);
}

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? ` (${detail})` : ""}`);
};
const get = (path) => fetch(`${origin}${path}`, { redirect: "manual" });

const health = await get("/api/health");
const body = await health.json().catch(() => ({}));
check(health.status === 200 && body.ok === true, "/api/health is healthy", `${health.status}`);
check(body.mode === expected, `mode is ${expected}`, `got ${body.mode}`);
check(
  body.demoFlagIgnored !== true,
  "AD_ANALYST_DEMO_MODE is not set beside Supabase variables",
);
check(health.headers.get("cache-control")?.includes("no-store"), "health is not cached");

const home = await get("/");
const h = (name) => home.headers.get(name) ?? "";
check(home.status === 200, "home page loads", `${home.status}`);
check(
  /script-src 'nonce-[^']+' 'strict-dynamic'/.test(h("content-security-policy")),
  "nonce CSP",
);
check(
  h("content-security-policy").includes("frame-ancestors 'none'"),
  "frame-ancestors 'none'",
);
check(h("x-frame-options") === "DENY", "X-Frame-Options DENY");
check(h("x-content-type-options") === "nosniff", "nosniff");
check(h("referrer-policy") === "strict-origin-when-cross-origin", "referrer policy");
check(h("permissions-policy").includes("camera=()"), "permissions policy");
check(!h("x-powered-by"), "no X-Powered-By");
if (origin.startsWith("https://"))
  check(
    /max-age=\d{8,}/.test(h("strict-transport-security")),
    "HSTS",
    h("strict-transport-security"),
  );

const app = await get("/insights");
if (expected === "supabase")
  check(
    app.status === 307 && (app.headers.get("location") ?? "").endsWith("/sign-in"),
    "signed-out /insights redirects to sign-in",
    `${app.status}`,
  );
else check(app.status === 200, "demo /insights is open", `${app.status}`);
const api = await fetch(`${origin}/api/import`, { method: "POST", redirect: "manual" });
check(
  expected === "supabase" ? api.status === 401 : api.status >= 400,
  "signed-out import is refused",
  `${api.status}`,
);

const robots = await (await get("/robots.txt")).text();
const sitemap = await (await get("/sitemap.xml")).text();
if (/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$/.test(new URL(origin).hostname))
  console.log("  - robots.txt and sitemap origin skipped: loopback origins are left out of both");
else {
  check(robots.includes(`${origin}/sitemap.xml`), "robots.txt names this origin's sitemap");
  check(sitemap.includes(`<loc>${origin}`), "sitemap uses this origin");
}
check((await get("/no-such-page")).status === 404, "unknown URL is a 404");

console.log(
  failures ? `\n${failures} deployment check(s) failed` : "\nDeployment checks passed",
);
process.exit(failures ? 1 : 0);
