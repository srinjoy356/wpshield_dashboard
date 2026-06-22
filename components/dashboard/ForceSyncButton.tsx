"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface Props {
  siteId: string;
  siteUrl: string;
  /** Optional label override — defaults to "Force Sync" */
  label?: string;
}

/**
 * ForceSyncButton — sends an immediate config-cache purge to the WordPress plugin.
 *
 * The actual HTTP call to the plugin is proxied through /api/admin/sites/force-sync
 * so the raw site token never hits the browser.
 *
 * Place this wherever a user needs to push config changes immediately, rather
 * than waiting for the plugin's 15-minute transient to expire.
 */
export function ForceSyncButton({ siteId, siteUrl, label = "Force Sync" }: Props) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sites/force-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Sync failed",
          description: data.error || "Could not reach the WordPress site.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Config synced",
          description: `${siteUrl} will use the latest config immediately.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Sync error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
        {syncing ? "Syncing…" : label}
      </button>
      <p className="text-xs text-[var(--muted)]">
        Pushes all config changes (maintenance, away mode, blocking) to{" "}
        <span className="font-mono">{siteUrl}</span> immediately.
      </p>
    </div>
  );
}