"use client";

import { ArrowRight, Mail } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { requestSignInLink, type SignInState } from "./actions";

/* The sign-in page's field and button (D-NEW-sign-in-1): a 44px input with a
   mail icon (48px from 1024px) and one dark full-width action to match.
   Behaviour is unchanged. They transition colour, background and border only,
   not outline-color, so the focus ring appears at once (DESIGN.md §20). */
const INPUT =
  "h-11 w-full rounded-md border border-border bg-surface pr-3 pl-10 text-[15px] text-ink lg:h-12 lg:text-base transition-[color,background-color,border-color] placeholder:text-ink-faint hover:border-border-strong focus:border-accent-border aria-[invalid=true]:border-negative";
const SUBMIT = `mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink text-[15px] font-medium text-white transition-[color,background-color,border-color] select-none hover:bg-ink-secondary active:bg-ink disabled:cursor-not-allowed disabled:opacity-70 lg:h-12 lg:text-base`;

/** Email-only sign-in: one field, one action, then "check your email". */
export function SignInForm({ linkError, next }: { linkError: boolean; next: string | null }) {
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
      <div className="mt-8 max-w-[366px] lg:mt-10 lg:max-w-[420px]" role="status">
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
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <button
            type="submit"
            disabled={pending}
            className={buttonClasses(
              "secondary",
              "md",
              "h-11 w-full text-[15px] transition-[color,background-color,border-color] lg:h-12 lg:text-base",
            )}
          >
            {pending ? "Sending…" : "Send another link"}
          </button>
        </form>
      </div>
    );

  const error = state.status === "error" ? state.message : null;
  return (
    <form action={action} className="mt-8 max-w-[366px] lg:mt-10 lg:max-w-[420px]">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {linkError && !error ? (
        <p role="alert" className="mb-4 text-sm text-negative">
          That sign-in link has expired or was already used. Request a new one.
        </p>
      ) : null}
      <label
        htmlFor="email"
        className="text-[13px] leading-5 font-medium text-ink-secondary lg:text-sm"
      >
        Work email
      </label>
      <div className="relative mt-1.5">
        <Mail
          aria-hidden
          size={18}
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted"
        />
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@agency.com"
          required
          defaultValue={state.email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
          className={INPUT}
        />
      </div>
      {error ? (
        <p
          id="email-error"
          role="alert"
          className="mt-1.5 text-xs text-negative lg:text-[13px]"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className={SUBMIT}
      >
        {pending ? (
          "Sending link…"
        ) : (
          <>
            Email me a sign-in link
            <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
          </>
        )}
      </button>
    </form>
  );
}
