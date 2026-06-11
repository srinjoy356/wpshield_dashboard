"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-surface p-8 text-center shadow-sm">
      <div className="mb-4 rounded-full bg-red-50 p-3">
        <AlertTriangle className="h-8 w-8 text-[var(--critical)]" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-xl font-bold text-[var(--foreground)]">Something went wrong!</h2>
      <p className="mb-6 max-w-md text-sm text-[var(--muted)]">
        An error occurred while fetching dashboard data. This might be a temporary connection
        issue with Supabase.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()} variant="outline">
          <RefreshCcw className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Try again
        </Button>
        <Button onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </div>
  );
}
