import { cn } from "@/lib/utils";

interface CompanyBadgeProps {
  companyId: string;
  className?: string;
}

export function CompanyBadge({ companyId, className }: CompanyBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-xs text-[var(--foreground)]",
        className
      )}
    >
      {companyId}
    </span>
  );
}
