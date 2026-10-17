/* The landing hero's words and its audit request, in one place: the page
   renders the lead and the home page's structured data quotes it (D-058), so
   both read from here. */

/*
 * Headline options (D-072). Option A is live. To swap, replace HERO_HEADLINE
 * and HERO_LEAD; keep each headline to two lines of at most 24 characters,
 * which is what fits unwrapped at 96px on a 1280px container.
 *
 * A (live)
 *   Find wasted spend / before your client does.
 *   Ad Analyst flags the campaigns spending without results in each client's
 *   Meta Ads account, with the figures behind it and the first thing to check.
 *
 * B
 *   Catch wasted spend / in every client account.
 *   Import each client's Meta Ads export. Ad Analyst flags spend that isn't
 *   turning into purchases or leads, against last week and the client's own
 *   cost target.
 *
 * C
 *   Every client account, / checked for waste.
 *   Ad Analyst reads each client's Meta Ads data and shows where money is going
 *   without results, so you raise it with the client before they raise it with
 *   you.
 */

/** The two headline lines; on phones `secondRest` moves to a third line. */
export const HERO_HEADLINE = {
  first: "Find wasted spend",
  second: "before your",
  secondRest: "client does.",
} as const;

export const HERO_LEAD =
  "Ad Analyst flags the campaigns spending without results in each client’s Meta Ads account, with the figures behind it and the first thing to check.";

export const AUDIT_SUBJECT = "Wasted-spend audit request";

export const AUDIT_BODY = [
  "Hi,",
  "",
  "I'd like a free wasted-spend audit.",
  "",
  "Agency name:",
  "Number of client ad accounts:",
  "A good time to talk:",
  "",
].join("\n");

/** The audit request as a mailto, or null without a contact address (never a dead link). */
export function auditMailto(email: string | null): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(AUDIT_SUBJECT)}&body=${encodeURIComponent(AUDIT_BODY)}`;
}
