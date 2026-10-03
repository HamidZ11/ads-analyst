"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A live product surface rendered at its native width, then cropped to the
 * part that proves the statement beside it and scaled to its slot. The UI is
 * the real component with seeded data: text stays crisp at any scale, and the
 * crop is inert, so it reads as an exhibit rather than a second app.
 */
export function ProductCrop({
  id,
  source,
  crop,
  label,
  maxScale = 1.6,
  fade,
  className,
  surfaceClassName,
  children,
}: {
  id?: string;
  /** Width the product surface is laid out at, in CSS pixels. */
  source: number;
  crop: Crop;
  /** What the crop shows, for people who cannot see it. */
  label: string;
  maxScale?: number;
  /** Fade the crop out toward one edge, where the real list continues beyond it. */
  fade?: "bottom";
  className?: string;
  surfaceClassName?: string;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  // Unknown until measured: the crop stays transparent rather than showing the
  // product at the wrong scale before hydration.
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      if (width > 0) setScale(Math.min(maxScale, width / crop.width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [crop.width, maxScale]);

  return (
    <div
      ref={frame}
      id={id}
      role="img"
      aria-label={label}
      className={cn("relative w-full overflow-hidden", className)}
      style={{
        aspectRatio: `${crop.width} / ${crop.height}`,
        maxWidth: crop.width * maxScale,
        maskImage:
          fade === "bottom"
            ? "linear-gradient(to bottom, #000 78%, transparent 100%)"
            : undefined,
      }}
    >
      <div
        inert
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0 bg-surface font-sans text-ink select-none",
          surfaceClassName,
        )}
        style={{
          width: source,
          transformOrigin: "0 0",
          transform: `scale(${scale ?? 1}) translate(${-crop.x}px, ${-crop.y}px)`,
          opacity: scale === null ? 0 : 1,
          transition: "opacity 320ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
