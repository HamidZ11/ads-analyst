/** Pure helpers for the sign-in form; kept apart from server code so they can be tested. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validEmail(email: string): boolean {
  return email.length <= 254 && EMAIL.test(email);
}

/**
 * What to tell the user when Supabase refuses a sign-in link. Null means "say
 * the link was sent": refusals that would reveal whether an address has an
 * account (sign-ups closed, unknown user) are deliberately indistinguishable.
 */
export function signInFailureMessage(error: { status?: number; code?: string }): string | null {
  if (
    error.code === "otp_disabled" ||
    error.code === "signup_disabled" ||
    error.code === "user_not_found"
  )
    return null;
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  )
    return "Too many sign-in requests. Wait a minute, then try again.";
  return "We couldn't send a sign-in link right now. Try again in a moment.";
}
