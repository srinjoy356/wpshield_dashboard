"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import { Company } from "@/types";

interface SiteOverride {
  id: string;
  url: string;
  maintenance_mode: boolean;
  site_controls_enabled: boolean;
}

interface Props {
  company: Company;
  site?: SiteOverride;
}

export function MaintenanceModeCard({ company, site }: Props) {
  const { toast } = useToast();
  const isPerSite = !!site;

  // Derive the correct initial value from DB data:
  // - Per-site with its own controls: use site.maintenance_mode
  // - Per-site inheriting: use company.maintenance_mode (what it currently shows)
  // - Company-wide: use company.maintenance_mode
  function resolveEnabled() {
    if (isPerSite) {
      return site!.site_controls_enabled
        ? site!.maintenance_mode          // site has its own override — show it
        : (company.maintenance_mode ?? false); // inheriting — show what it's inheriting
    }
    return company.maintenance_mode ?? false;
  }

  const [enabled, setEnabled] = useState(resolveEnabled);
  const [loading, setLoading] = useState(false);

  // When the user picks a different site from the dropdown, re-derive from DB data.
  // Without this, useState holds the first site's value even after the prop changes.
  useEffect(() => {
    setEnabled(resolveEnabled());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, site?.maintenance_mode, site?.site_controls_enabled, company.maintenance_mode]);

  async function handleToggle(newValue: boolean) {
    setLoading(true);
    try {
      const endpoint = isPerSite ? "/api/settings/site-maintenance" : "/api/settings/maintenance";
      const payload  = isPerSite
        ? { site_id: site!.id, enabled: newValue }
        : { enabled: newValue, company_id: company.company_id };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      setEnabled(newValue);
      toast({
        title: newValue ? "Maintenance mode enabled" : "Maintenance mode disabled",
        description: newValue
          ? isPerSite
            ? `${site!.url} will show the maintenance page.`
            : "All your sites will show the maintenance page."
          : isPerSite
            ? `${site!.url} is back online.`
            : "Your sites are back online.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isPerSite
              ? `Show a maintenance page to all non-admin visitors on ${site!.url}.`
              : "Show a maintenance page to all non-admin visitors across all your sites."}
          </p>
          {isPerSite && !site!.site_controls_enabled && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
              Currently inheriting company-wide setting
              ({company.maintenance_mode ? "ON" : "OFF"}).
              Toggling will create a per-site override.
            </p>
          )}
          {isPerSite && site!.site_controls_enabled && (
            <p className="mt-2 text-xs text-[var(--muted)] bg-[var(--surface-subtle)] border border-[var(--border)] rounded px-2 py-1 inline-block">
              Using site-specific setting (not company default).
            </p>
          )}
        </div>

        {/* Toggle */}
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

      {/* Live status */}
      <p className="mt-3 text-sm text-[var(--muted)]">
        Status:{" "}
        <span className={enabled ? "font-medium text-red-500" : "text-[var(--foreground)]"}>
          {enabled ? "ON — Maintenance page is showing" : "OFF — Site is live"}
        </span>
      </p>

      {enabled && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">
            <strong>
              {isPerSite
                ? `${site!.url} is in maintenance mode.`
                : "Your sites are in maintenance mode."}
            </strong>{" "}
            Visitors cannot access the site. Turn this off when done.
          </p>
        </div>
      )}
    </div>
  );
}