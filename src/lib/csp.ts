/**
 * The Content Security Policy, built per request by the proxy with a fresh
 * nonce (D-NEW-launch-csp). Scripts run only if they carry the nonce, which
 * Next.js adds to its own scripts when it finds the policy on the request,
 * or if a nonced script loaded them ('strict-dynamic'); there is no
 * 'unsafe-inline' for scripts, and no 'self' fallback, which every supported
 * browser ignores beside 'strict-dynamic' (Firefox warns about it).
 * Everything else is same-origin: fonts are self-hosted by next/font, there
 * are no third-party scripts and no browser Supabase client. Inline styles stay allowed: React style attributes and
 * the style tags Radix injects carry no nonce. React needs 'unsafe-eval' in
 * development only. Billing's forms post to this app, which answers with a
 * redirect to Stripe Checkout or the customer portal; browsers apply
 * form-action to that redirect, so those two Stripe origins are allowed too
 * (D-088).
 */
export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** A random, unguessable nonce for one request (128 bits, base64). */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
