"use client";

import { useState } from "react";
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
  /** When provided, controls per-site maintenance mode for this site only */
  site?: SiteOverride;
}

/**
 * MaintenanceModeCard
 *
 * Two modes:
 * - Company mode (site prop absent): toggles companies.maintenance_mode,
 *   which applies to ALL sites of this company that don't have per-site
 *   controls enabled. Original behaviour, fully backward compatible.
 *
 * - Per-site mode (site prop present): toggles sites.maintenance_mode for
 *   that site only, and sets sites.site_controls_enabled = true, so this
 *   site stops inheriting the company-level setting.
 *
 * Force Sync has been moved to <ForceSyncButton> and should be placed
 * at the page level so it applies to all features, not just maintenance mode.
 */
export function MaintenanceModeCard({ company, site }: Props) {
  const { toast } = useToast();

  const initialEnabled = site
    ? (site.site_controls_enabled ? site.maintenance_mode : company.maintenance_mode ?? false)
    : (company.maintenance_mode ?? false);

  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  const isPerSite = !!site;

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
          <h3 className="text-base font-medium text-[var(--foreground)]">
            Maintenance Mode
            {isPerSite && (
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                — this site only
              </span>
            )}
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isPerSite
              ? `Show a branded maintenance page to all non-admin visitors on ${site!.url}. Other sites are unaffected.`
              : "Show a branded maintenance page to all non-admin visitors. Logged-in administrators bypass it automatically."}
          </p>
          {isPerSite && !site!.site_controls_enabled && (
            <p className="mt-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
              Currently inheriting company-wide setting. Toggling will enable per-site control.
            </p>
          )}
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
            <strong>
              {isPerSite ? `${site!.url} is currently in maintenance mode.` : "Your site is currently in maintenance mode."}
            </strong>{" "}
            Visitors cannot access it. Remember to turn this off when your maintenance work is complete.
          </p>
        </div>
      )}
    </div>
  );
}