"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { UserProfile, Company } from "@/types";
import { cn } from "@/lib/utils";
import { RefreshCw, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { MaintenanceModeCard } from "@/components/dashboard/MaintenanceModeCard";
import { AwayModeBuilder } from "@/components/dashboard/AwayModeBuilder";
import { BlockingManager } from "@/components/dashboard/BlockingManager";
import { GeoBlockingManager } from "@/components/dashboard/GeoBlockingManager";
import { HardeningControls } from "@/components/dashboard/HardeningControls";
import { UpgradeLock } from "@/components/billing/UpgradeGate";

interface SiteRow {
  id: string;
  url: string;
  maintenance_mode: boolean;
  away_mode_schedule: any;
  site_controls_enabled: boolean;
}

interface FeatureFlags {
  ipBlocking:      boolean;
  geoBlocking:     boolean;
  awayMode:        boolean;
  maintenanceMode: boolean;
}

interface Props {
  profile:        UserProfile;
  company:        Company | null;
  sites?:         SiteRow[];
  selectedSiteId?: string | null;
  features?:      FeatureFlags;
}

const DEFAULT_FEATURES: FeatureFlags = {
  ipBlocking:      false,
  geoBlocking:     false,
  awayMode:        false,
  maintenanceMode: true,
};

export function FirewallPageContent({
  profile,
  company,
  sites = [],
  selectedSiteId: initialSiteId = null,
  features = DEFAULT_FEATURES,
}: Props) {
  const { toast }  = useToast();
  const [activeTab, setActiveTab]       = useState("Site Controls");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    initialSiteId ?? (sites.length === 1 ? sites[0].id : null)
  );
  const [syncing, setSyncing] = useState(false);

  const tabs = ["Site Controls", "Hardening"];

  const selectedSite = selectedSiteId
    ? sites.find((s) => s.id === selectedSiteId) ?? null
    : null;

  // ── Force Sync — single button, targets selected site or all ──────────────
  async function handleForceSync() {
    const targets = selectedSite ? [selectedSite] : sites;
    if (targets.length === 0) {
      toast({ title: "No sites", description: "No active sites to sync.", variant: "destructive" });
      return;
    }

    setSyncing(true);
    let failed = 0;

    for (const site of targets) {
      try {
        const res = await fetch("/api/admin/sites/force-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site_id: site.id }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    setSyncing(false);

    if (failed === 0) {
      toast({
        title: "Config synced",
        description: selectedSite
          ? `${selectedSite.url} will use the latest config immediately.`
          : `All ${targets.length} site${targets.length > 1 ? "s" : ""} synced.`,
      });
    } else {
      toast({
        title: "Sync partially failed",
        description: `${failed} of ${targets.length} site${targets.length > 1 ? "s" : ""} could not be reached.`,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Firewall & Security"
        subtitle="Active defense, blocklists, and hardening controls."
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-56 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "w-full text-left rounded-lg px-4 py-2.5 text-sm transition-colors",
                activeTab === tab
                  ? "bg-[var(--foreground)] font-medium text-[var(--background)] shadow-sm"
                  : "text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Main panel */}
        <div className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm min-h-[400px]">

          {activeTab === "Site Controls" && (
            <div className="space-y-8">
              {company ? (
                <>
                  {/* ── Top bar: site selector + force sync ────────────────── */}
                  <div className="flex items-center gap-3 flex-wrap">

                    {/* Site dropdown */}
                    {sites.length > 1 && (
                      <div className="relative">
                        <select
                          value={selectedSiteId ?? ""}
                          onChange={(e) => setSelectedSiteId(e.target.value || null)}
                          className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] pl-3 pr-8 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] cursor-pointer"
                        >
                          <option value="">All sites</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.url.replace(/^https?:\/\//, "")}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
                      </div>
                    )}

                    {/* Single Force Sync button */}
                    <button
                      onClick={handleForceSync}
                      disabled={syncing || sites.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)] disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} strokeWidth={1.5} />
                      {syncing
                        ? "Syncing…"
                        : selectedSite
                        ? `Sync ${selectedSite.url.replace(/^https?:\/\//, "")}`
                        : sites.length > 1
                        ? "Sync all sites"
                        : `Sync ${sites[0]?.url.replace(/^https?:\/\//, "") ?? ""}`}
                    </button>

                    {/* Context label */}
                    <p className="text-xs text-[var(--muted)]">
                      {selectedSite
                        ? `Showing controls for ${selectedSite.url.replace(/^https?:\/\//, "")}`
                        : sites.length > 1
                        ? "Showing company-wide settings — select a site for per-site controls"
                        : "Pushes config changes to the plugin immediately"}
                    </p>
                  </div>

                  {/* ── Maintenance Mode ───────────────────────────────────── */}
                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        Maintenance Mode
                        {selectedSite && (
                          <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                            — {selectedSite.url.replace(/^https?:\/\//, "")} only
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Show a branded maintenance page to all non-admin visitors.
                        {!selectedSite && sites.length > 1 && " Applies to all sites without per-site controls."}
                      </p>
                    </div>
                    <MaintenanceModeCard
                      company={company}
                      site={selectedSite ?? undefined}
                    />
                  </section>

                  {/* ── Away Mode ──────────────────────────────────────────── */}
                  <section className="space-y-3 border-t border-[var(--border)] pt-8">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        Away Mode
                        {selectedSite && (
                          <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                            — {selectedSite.url.replace(/^https?:\/\//, "")} only
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Restrict wp-admin access to specific days and hours.
                      </p>
                    </div>
                    {features.awayMode ? (
                      <AwayModeBuilder company={company} site={selectedSite ?? undefined} />
                    ) : (
                      <UpgradeLock
                        feature="Away Mode"
                        requiredPlan="Solo"
                        description="Restrict wp-admin to specific hours and days. Available on Solo plan and above."
                      />
                    )}
                  </section>

                  {/* ── IP Blocking ────────────────────────────────────────── */}
                  <section className="space-y-3 border-t border-[var(--border)] pt-8">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">IP Blocking</h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Block specific IP addresses across all your sites.
                      </p>
                    </div>
                    {features.ipBlocking ? (
                      <BlockingManager company={company} />
                    ) : (
                      <UpgradeLock
                        feature="IP Blocking"
                        requiredPlan="Solo"
                        description="Block specific IPs from accessing your WordPress sites. Available on Solo plan and above."
                      />
                    )}
                  </section>

                  {/* ── Geo Blocking ───────────────────────────────────────── */}
                  <section className="space-y-3 border-t border-[var(--border)] pt-8">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">Geo Blocking</h3>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        Block entire countries from accessing your sites.
                      </p>
                    </div>
                    {features.geoBlocking ? (
                      <GeoBlockingManager company={company} />
                    ) : (
                      <UpgradeLock
                        feature="Geo Blocking"
                        requiredPlan="Solo"
                        description="Block traffic from specific countries. Available on Solo plan and above."
                      />
                    )}
                  </section>
                </>
              ) : (
                <p className="text-sm text-[var(--muted)]">No company data available.</p>
              )}
            </div>
          )}

          {activeTab === "Hardening" && (
            <div className="space-y-4">
              {company
                ? <HardeningControls company={company} />
                : <p className="text-sm text-[var(--muted)]">No company data available.</p>
              }
            </div>
          )}

        </div>
      </div>
    </div>
  );
}