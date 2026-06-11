import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" />
      
      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2 h-[350px] rounded-2xl border border-[var(--border)] bg-surface p-6">
           <Skeleton className="h-full w-full" />
        </div>
        <div className="h-[350px] rounded-2xl border border-[var(--border)] bg-surface p-6">
           <Skeleton className="h-full w-full" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
