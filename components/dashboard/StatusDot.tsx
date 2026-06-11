import { cn } from "@/lib/utils";
import { CompanyStatus } from "@/types";

const dotConfig: Record<CompanyStatus, { color: string; label: string }> = {
  active: { color: "bg-[var(--success)]", label: "Active" },
  pending: { color: "bg-amber-400", label: "Pending" },
  invited: { color: "bg-blue-400", label: "Invited" },
  onboarded: { color: "bg-[var(--success)]", label: "Onboarded" },
  stale: { color: "bg-[var(--critical)]", label: "Stale" },
  suspended: { color: "bg-gray-400", label: "Suspended" },
};

interface StatusDotProps {
  status: CompanyStatus;
  showLabel?: boolean;
  className?: string;
}

export function StatusDot({ status, showLabel = true, className }: StatusDotProps) {
  const config = dotConfig[status] || { color: "bg-gray-400", label: "Unknown" };
  
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("h-2 w-2 rounded-full", config.color)} />
      {showLabel && (
        <span className="text-sm text-[var(--foreground)]">{config.label}</span>
      )}
    </span>
  );
}
