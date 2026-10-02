import { cn } from "@/lib/cn";

export interface ProductMarkProps {
  agencyName?: string;
  size?: "sm" | "lg";
  className?: string;
}

export function ProductMark({ agencyName, size = "sm", className }: ProductMarkProps) {
  const large = size === "lg";
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-ink text-white",
          large ? "size-7" : "size-6",
        )}
      >
        <svg width={large ? 16 : 14} height={large ? 16 : 14} viewBox="0 0 14 14" fill="none">
          <path
            d="M2 11.5 6.2 2.5h1.6L12 11.5h-1.9l-1-2.3H4.9l-1 2.3H2Zm3.5-3.8h3L7 4.2 5.5 7.7Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block truncate font-semibold tracking-tight text-ink",
            large ? "text-base" : "text-sm",
          )}
        >
          Ad Analyst
        </span>
        {agencyName ? (
          <span className="block truncate text-xs text-ink-muted">{agencyName}</span>
        ) : null}
      </span>
    </span>
  );
}
