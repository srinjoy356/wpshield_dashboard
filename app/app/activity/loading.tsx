import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  );
}