/** Cookie names shared by the server workspace reader and its actions. */
export const CLIENT_COOKIE = "aa_client";
export const RANGE_COOKIE = "aa_range";
/**
 * The client report's own period: a report is sent for a week by default, so
 * it opens on 7D rather than inheriting a "Today" chosen on another page.
 */
export const REPORT_RANGE_COOKIE = "aa_report_range";
/** The active workspace when a user belongs to more than one (a preference, never a permission). */
export const WORKSPACE_COOKIE = "aa_workspace";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
