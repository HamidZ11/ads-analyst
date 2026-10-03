"use client";

import { useOptimistic, useTransition } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DATE_PRESETS, type DatePreset } from "@/domain/periods";
import { selectDatePreset } from "@/features/workspace/actions";
import { cn } from "@/lib/cn";

const OPTIONS = DATE_PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  disabled: !p.available,
  title: p.available ? undefined : "Custom ranges arrive with the full date engine",
}));

export function DatePresetControl({
  value,
  className,
}: {
  value: DatePreset;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  // The indicator moves immediately; the server confirms (or reverts) after the action.
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);

  return (
    <SegmentedControl
      label="Date range"
      options={OPTIONS}
      value={optimisticValue}
      onChange={(next) =>
        startTransition(async () => {
          setOptimisticValue(next);
          await selectDatePreset(next);
        })
      }
      className={cn("transition-opacity duration-quick", pending && "opacity-70", className)}
    />
  );
}
