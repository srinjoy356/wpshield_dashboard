import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeader title="Clients" />
      
      {/* Pending sites skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Onboarded clients skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-surface overflow-hidden">
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
