"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface TimeRange {
  label: string;
  value: string;
}

interface TimeRangeTabsProps {
  onChange?: (range: string) => void;
  className?: string;
  ranges?: TimeRange[];
  defaultRange?: string;
}

const defaultRanges: TimeRange[] = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "Custom", value: "custom" },
];

export function TimeRangeTabs({ 
  onChange, 
  className, 
  ranges = defaultRanges,
  defaultRange = "7d"
}: TimeRangeTabsProps) {
  const [active, setActive] = useState(defaultRange);

  return (
    <div className={cn("inline-flex gap-1 rounded-lg bg-[var(--surface-subtle)] p-1", className)}>
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => {
            setActive(r.value);
            onChange?.(r.value);
          }}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active === r.value
              ? "bg-surface text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
