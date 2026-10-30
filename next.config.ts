import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Headers for every response. The Content Security Policy is not here: it
 * needs a fresh nonce per request, so `src/proxy.ts` sets it (see
 * `src/lib/csp.ts`). Two policies would both be enforced, so it must not be
 * added here as well.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Browsers ignore HSTS over plain HTTP; left out of development so an HTTPS
  // dev server does not pin localhost. includeSubDomains is safe on .app,
  // which browsers already force to HTTPS for every name.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
