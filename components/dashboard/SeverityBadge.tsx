import { cn } from "@/lib/utils";
import { Severity } from "@/types";

const severityConfig: Record<Severity, { label: string; bg: string; text: string }> = {
  low: { label: "Low", bg: "bg-green-50", text: "text-[var(--success)]" },
  medium: { label: "Medium", bg: "bg-amber-50", text: "text-[var(--warning)]" },
  high: { label: "High", bg: "bg-orange-50", text: "text-[var(--alert)]" },
  critical: { label: "Critical", bg: "bg-red-50", text: "text-[var(--critical)]" },
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}
