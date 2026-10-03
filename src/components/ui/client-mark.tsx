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
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  /** `solid`: accent fill when selected (lists). `soft`: pale-blue fill (the sidebar switcher). */
  tone?: "solid" | "soft";
  /** Shows a small data-connection dot on the mark's corner. */
  connected?: boolean;
  className?: string;
}

/** Initials block used wherever a client is listed. */
export function ClientMark({
  name,
  size = "md",
  selected = false,
  tone = "solid",
  connected = false,
  className,
}: ClientMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center font-semibold tracking-tight",
        size === "sm" && "size-5 rounded-sm text-[10px]",
        size === "md" && "size-6 rounded-sm text-2xs",
        size === "lg" && "size-7 rounded-md text-2xs",
        selected
          ? tone === "soft"
            ? "bg-accent-soft text-accent-strong"
            : "bg-accent text-white"
          : "bg-surface-active text-ink-secondary",
        className,
      )}
    >
      {clientInitials(name)}
      {connected ? (
        <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-positive ring-2 ring-surface" />
      ) : null}
    </span>
  );
}
