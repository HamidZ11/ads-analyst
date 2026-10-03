"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

interface Indicator {
  x: number;
  width: number;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Button group with a single pale-blue indicator that slides to the selected
 * segment. Server markup colours the selected button directly; once measured
 * on the client the indicator takes over so the move is animated.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [animated, setAnimated] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const selected = group.querySelector<HTMLElement>('[aria-pressed="true"]');
      setIndicator(selected ? { x: selected.offsetLeft, width: selected.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [value, options]);

  // Enable the slide only after the first measurement has painted, so the
  // indicator never animates in from the origin on load.
  useEffect(() => {
    if (indicator && !animated) {
      const frame = requestAnimationFrame(() => setAnimated(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [indicator, animated]);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={label}
      className={cn(
        "relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-border bg-surface p-0.5",
        className,
      )}
    >
      {indicator ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0.5 left-0 rounded-sm bg-accent-soft",
            animated && "transition-[transform,width] duration-standard ease-standard",
          )}
          style={{ transform: `translateX(${indicator.x}px)`, width: indicator.width }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-sm font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-xs",
              selected
                ? cn("text-accent-strong", !indicator && "bg-accent-soft")
                : "text-ink-muted hover:bg-surface-hover hover:text-ink active:bg-surface-active",
              option.disabled &&
                "cursor-not-allowed text-ink-faint hover:bg-transparent hover:text-ink-faint",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
