import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] sm:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3 mt-3 sm:mt-0">{children}</div>}
    </div>
  );
}
