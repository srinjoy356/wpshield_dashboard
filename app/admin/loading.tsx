import { PageHeader } from "@/components/dashboard/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeader title="Overview" subtitle="Loading dashboard data..." />
      
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]" />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2 h-[350px] rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]" />
        <div className="h-[350px] rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]" />
      </div>

      {/* Table Skeleton */}
      <div className="h-64 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]" />
    </div>
  );
}
