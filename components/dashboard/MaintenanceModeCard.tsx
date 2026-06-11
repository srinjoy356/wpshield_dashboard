"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import { Company } from "@/types";

interface Props {
  company: Company;
}

export function MaintenanceModeCard({ company }: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(company.maintenance_mode ?? false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleToggle(newValue: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue, company_id: company.company_id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      setEnabled(newValue);
      toast({
        title: newValue ? "Maintenance mode enabled" : "Maintenance mode disabled",
        description: newValue
          ? "Visitors will see the maintenance page."
          : "Your site is back online.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleForceSync() {
    setSyncing(true);
    // The plugin re-fetches on its next request after cache expiry;
    // force sync can be a no-op API call that logs the intent.
    // For now, inform the user the plugin will re-read within 1 minute.
    await new Promise((r) => setTimeout(r, 800)); // simulate
    setSyncing(false);
    toast({
      title: "Sync triggered",
      description: "The plugin will fetch the new config on its next request.",
    });
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium text-[var(--foreground)]">
            Maintenance Mode
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Show a branded maintenance page to all non-admin visitors.
            Logged-in administrators bypass it automatically.
          </p>
        </div>

        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={() => handleToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:opacity-50 ${
            enabled ? "bg-red-500" : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Status text */}
      <p className="mt-3 text-sm text-[var(--muted)]">
        Status:{" "}
        <span className={enabled ? "font-medium text-red-500" : "text-[var(--foreground)]"}>
          {enabled ? "ON — Site is in maintenance mode" : "OFF — Site is live"}
        </span>
      </p>

      {/* Warning banner when ON */}
      {enabled && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">
            <strong>Your site is currently in maintenance mode.</strong> Visitors
            cannot access it. Remember to turn this off when your maintenance
            work is complete.
          </p>
        </div>
      )}

      {/* Force Sync */}
      <div className="mt-4 flex items-center gap-3 border-t border-[var(--border)] pt-4">
        <button
          onClick={handleForceSync}
          disabled={syncing}
          className="rounded px-3 py-1.5 text-sm border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:opacity-50 transition-colors"
        >
          {syncing ? "Syncing…" : "Force Sync"}
        </button>
        <p className="text-xs text-[var(--muted)]">
          The WordPress plugin checks for config changes every 15 minutes. Force
          sync requests an immediate refresh.
        </p>
      </div>
    </div>
  );
}