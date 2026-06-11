import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader title="File Integrity" />
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface overflow-hidden">
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
