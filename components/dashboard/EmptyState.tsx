import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-surface py-16 px-8 text-center",
        className
      )}
    >
      <Icon className="mb-4 h-12 w-12 text-[var(--muted-foreground)]" strokeWidth={1.5} />
      <h3 className="mb-1 text-base font-semibold text-[var(--foreground)]">{title}</h3>
      {description && (
        <p className="mb-4 max-w-sm text-sm text-[var(--muted)]">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
