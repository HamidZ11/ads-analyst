import { cn } from "@/lib/cn";

export function ProductMark({
  className,
  agencyName,
}: {
  className?: string;
  agencyName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded-md bg-ink text-white"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 11.5 6.2 2.5h1.6L12 11.5h-1.9l-1-2.3H4.9l-1 2.3H2Zm3.5-3.8h3L7 4.2 5.5 7.7Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-ink">Ad Analyst</span>
        {agencyName ? (
          <span className="block truncate text-2xs text-ink-muted">{agencyName}</span>
        ) : null}
      </span>
    </span>
  );
}
