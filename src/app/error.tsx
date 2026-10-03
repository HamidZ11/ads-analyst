"use client";

import { buttonClasses } from "@/components/ui/button";

/**
 * A recoverable failure (for example the workspace could not be loaded).
 * Never shows raw errors; offers a retry and a way out.
 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section aria-labelledby="error-title" className="max-w-[520px] py-10">
      <h1 id="error-title" className="text-xl font-semibold tracking-[-0.02em] text-ink">
        This page couldn&apos;t load
      </h1>
      <p className="mt-2 text-sm leading-5 text-ink-muted">
        Your data is safe. The workspace may be temporarily unavailable; try again in a moment.
      </p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={reset} className={buttonClasses("primary")}>
          Try again
        </button>
        <a href="/sign-in" className={buttonClasses("secondary")}>
          Sign in again
        </a>
      </div>
    </section>
  );
}
