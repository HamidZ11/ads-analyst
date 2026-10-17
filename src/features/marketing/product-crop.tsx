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
 *
 * By default the scale is measured after hydration, so the crop is
 * transparent until JavaScript runs. With `cssScale` the scale is CSS: the
 * frame is a size container and the surface scales by
 * `tan(atan2(100cqw, <crop width>px))`, which is the frame's width divided by
 * the crop's as a plain number. The server render is then already at its
 * final size and position, visible without JavaScript. Browsers without CSS
 * trigonometry fall back to the measured scale.
 */
export function ProductCrop({
  id,
  source,
  crop,
  label,
  maxScale = 1.6,
  fade,
  cssScale = false,
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
  /** Scale in CSS, so the first paint is final and needs no JavaScript. */
  cssScale?: boolean;
  className?: string;
  surfaceClassName?: string;
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  // Unknown until measured: without `cssScale` the crop stays transparent
  // rather than showing the product at the wrong scale before hydration.
  const [scale, setScale] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    if (cssScale && CSS.supports("scale", `tan(atan2(1px, 2px))`)) return;
    const measure = () => {
      const width = element.clientWidth;
      if (width > 0) setScale(Math.min(maxScale, width / crop.width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [crop.width, maxScale, cssScale]);

  const offset = `translate(${-crop.x}px, ${-crop.y}px)`;
  const transform =
    scale !== null
      ? `scale(${scale}) ${offset}`
      : cssScale
        ? `scale(tan(atan2(100cqw, ${crop.width}px))) ${offset}`
        : `scale(1) ${offset}`;
  const visible = cssScale || scale !== null;

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
        containerType: cssScale ? "inline-size" : undefined,
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
          transform,
          opacity: visible ? 1 : 0,
          transition: cssScale ? undefined : "opacity 320ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
