import type { ReactNode } from "react";

/**
 * The plain page a share link shows when it can't show a report: expired or
 * revoked, unknown, rate limited or unavailable. The sign-in column's shape
 * (DESIGN.md §27), with no product navigation and nothing to click: the
 * person reading it is the agency's client, not a user of the app.
 */
export function SharedNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      id="main"
      className="flex min-h-dvh items-start justify-center bg-surface px-4 pt-[18vh]"
    >
      <section aria-labelledby="shared-notice-title" className="w-full max-w-[360px]">
        <h1
          id="shared-notice-title"
          className="text-xl font-semibold tracking-[-0.02em] text-ink"
        >
          {title}
        </h1>
        <p className="mt-2 text-sm leading-5 text-ink-muted">{children}</p>
      </section>
    </main>
  );
}
