"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./product-crop.module.css";

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
 *
 * The crop is always visible. Before hydration it scales by the inherited
 * `--crop-scale` custom property, which a slot can set per breakpoint to a
 * value at or just under its true scale (the hero does, D-075); without one it
 * renders unscaled and clipped. After hydration the measured scale replaces
 * it exactly. No CSS maths is involved: WebKit evaluates
 * `tan(atan2(<container unit>, <length>))` with the angle in degrees as if it
 * were radians, which scaled the hero crop negatively, off its frame.
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
  // Null until measured; the CSS default carries the first paint.
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

  const offset = `translate(${-crop.x}px, ${-crop.y}px)`;
  const transform = `scale(${scale ?? "var(--crop-scale, 1)"}) ${offset}`;

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
          s.surface,
          surfaceClassName,
        )}
        style={{
          width: source,
          transformOrigin: "0 0",
          transform,
        }}
      >
        {children}
      </div>
    </div>
  );
}
