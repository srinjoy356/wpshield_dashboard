"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/utils";

interface TimeCellProps {
  dateStr: string;
  className?: string;
}

export function TimeCell({ dateStr, className }: TimeCellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <span
      className={cn("text-sm text-[var(--foreground)]", className)}
      title={formatAbsoluteTime(dateStr)}
      suppressHydrationWarning
    >
      {!mounted ? dateStr : formatRelativeTime(dateStr)}
    </span>
  );
}
