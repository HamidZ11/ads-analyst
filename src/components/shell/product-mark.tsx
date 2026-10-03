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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 11.5 6.2 2.5h1.6L12 11.5h-1.9l-1-2.3H4.9l-1 2.3H2Zm3.5-3.8h3L7 4.2 5.5 7.7Z"
            fill="currentColor"
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
