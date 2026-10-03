"use client";

import { useActionState, useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { requestSignInLink, type SignInState } from "./actions";

const INPUT =
  "mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong aria-[invalid=true]:border-negative";

/** Email-only sign-in: one field, one action, then "check your email". */
export function SignInForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(requestSignInLink, {
    status: "idle",
    message: null,
    email: "",
  });
  const sentRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.status === "sent") sentRef.current?.focus();
  }, [state.status]);

  if (state.status === "sent")
    return (
      <div className="mt-6" role="status">
        <h2
          ref={sentRef}
          tabIndex={-1}
          className="text-base font-semibold text-ink outline-none"
        >
          Check your email
        </h2>
        <p className="mt-1 text-sm leading-5 text-ink-muted">
          If <span className="font-medium text-ink">{state.email}</span> can sign in, a link is
          on its way. Open it in this browser to continue; it expires after a short while.
        </p>
        <form action={action} className="mt-4">
          <input type="hidden" name="email" value={state.email} />
          <button type="submit" disabled={pending} className={buttonClasses("secondary")}>
            {pending ? "Sending…" : "Send another link"}
          </button>
        </form>
      </div>
    );

  const error = state.status === "error" ? state.message : null;
  return (
    <form action={action} className="mt-6">
      {linkError && !error ? (
        <p role="alert" className="mb-4 text-sm text-negative">
          That sign-in link has expired or was already used. Request a new one.
        </p>
      ) : null}
      <label htmlFor="email" className="text-xs font-medium text-ink-muted">
        Work email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "email-error" : undefined}
        className={INPUT}
      />
      {error ? (
        <p id="email-error" role="alert" className="mt-1 text-xs text-negative">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className={buttonClasses("primary", "md", "mt-4 w-full")}
      >
        {pending ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
