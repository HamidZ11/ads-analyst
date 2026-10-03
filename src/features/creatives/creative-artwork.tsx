import { CreativeThumbnail } from "@/components/ui/creative-thumbnail";
import type { CreativeThumbnail as ThumbnailRef, CreativeType } from "@/domain/types";
import { cn } from "@/lib/cn";

/**
 * Artwork in a fixed box so every entry at a hierarchy level shares one size
 * whatever the asset's native aspect. Large boxes keep the type and aspect
 * markers; small boxes show the motif alone.
 */
export function CreativeArtwork({
  thumbnail,
  type,
  width,
  height,
  className,
}: {
  thumbnail: ThumbnailRef;
  type: CreativeType;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-surface-subtle",
        className,
      )}
      style={{ width, height }}
    >
      <span className="block" style={{ width }}>
        <CreativeThumbnail
          thumbnail={thumbnail}
          type={type}
          frame="square"
          size={width >= 96 ? "lg" : "sm"}
          className="rounded-none"
        />
      </span>
    </span>
  );
}
