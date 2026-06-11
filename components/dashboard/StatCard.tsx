import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Sparkline } from "./Sparkline";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  sparklineData?: { value: number }[];
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  icon: Icon,
  sparklineData,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            {label}
          </p>
          <p className="text-3xl font-semibold text-[var(--foreground)]">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {delta && (
            <div className="flex items-center gap-1">
              {deltaType === "positive" && (
                <TrendingUp className="h-3 w-3 text-[var(--success)]" strokeWidth={1.5} />
              )}
              {deltaType === "negative" && (
                <TrendingDown className="h-3 w-3 text-[var(--critical)]" strokeWidth={1.5} />
              )}
              <span
                className={cn(
                  "text-xs",
                  deltaType === "positive" && "text-[var(--success)]",
                  deltaType === "negative" && "text-[var(--critical)]",
                  deltaType === "neutral" && "text-[var(--muted)]"
                )}
              >
                {delta}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-[var(--surface-subtle)] p-2">
            <Icon className="h-5 w-5 text-[var(--muted)]" strokeWidth={1.5} />
          </div>
        )}
      </div>
      {sparklineData && <Sparkline data={sparklineData} />}
    </div>
  );
}
