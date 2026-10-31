import { cn } from "@/lib/cn";

/**
 * Product identity: a 28px ink mark, the wordmark, and the agency as a quiet
 * second line. Clear, never loud; the content area stays the focus.
 */
export function ProductMark({
  className,
  agencyName,
}: {
  className?: string;
  agencyName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ink text-white"
      >
        {/* The chart mark, as in the favicon and on the marketing site (D-NEW-sign-in-1). */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 16.5 10.2 12l3 2.6L18 8.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-base font-semibold tracking-[-0.01em] text-ink">
          Ad Analyst
        </span>
        {agencyName ? (
          <span className="block truncate text-xs text-ink-muted">{agencyName}</span>
        ) : null}
      </span>
    </span>
  );
}
