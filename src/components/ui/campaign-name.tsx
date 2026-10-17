import { splitCampaignName } from "@/domain/labels";
import { cn } from "@/lib/cn";

/**
 * A campaign name that may be pipe-separated: the last segment is the label,
 * with the earlier segments as quieter context above it. The full name stays
 * the hover title and the accessible name. A name without pipes renders
 * exactly as one line of the caller's classes.
 */
export function CampaignName({
  name,
  prefix,
  className,
  contextClassName,
}: {
  name: string;
  /** Text before the label on the same line, e.g. "Campaign · ". */
  prefix?: string;
  /** Classes for the label: size, weight, colour and truncation or clamping (`truncate`, `line-clamp-2`). */
  className?: string;
  contextClassName?: string;
}) {
  const { primary, context } = splitCampaignName(name);
  if (!context)
    return (
      <span className={cn("block", className)} title={name}>
        {prefix}
        {name}
      </span>
    );

  return (
    <span className="block min-w-0" title={name}>
      <span className="sr-only">
        {prefix}
        {name}
      </span>
      <span
        aria-hidden
        className={cn("block truncate text-2xs leading-4 text-ink-muted", contextClassName)}
      >
        {context}
      </span>
      <span aria-hidden className={cn("block", className)}>
        {prefix}
        {primary}
      </span>
    </span>
  );
}
