import { cn } from "@/lib/cn";

export function clientInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export interface ClientMarkProps {
  name: string;
  size?: "sm" | "md";
  selected?: boolean;
  className?: string;
}

/** Initials block used wherever a client is listed. */
export function ClientMark({
  name,
  size = "md",
  selected = false,
  className,
}: ClientMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm font-semibold tracking-tight",
        size === "sm" ? "size-5 text-[10px]" : "size-6 text-2xs",
        selected ? "bg-accent text-white" : "bg-surface-active text-ink-secondary",
        className,
      )}
    >
      {clientInitials(name)}
    </span>
  );
}
