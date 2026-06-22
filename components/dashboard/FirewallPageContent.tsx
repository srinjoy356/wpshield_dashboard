"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { UserProfile, Company } from "@/types";
import { cn } from "@/lib/utils";

import { MaintenanceModeCard } from "@/components/dashboard/MaintenanceModeCard";
import { AwayModeBuilder } from "@/components/dashboard/AwayModeBuilder";
import { BlockingManager } from "@/components/dashboard/BlockingManager";
import { GeoBlockingManager } from "@/components/dashboard/GeoBlockingManager";
import { HardeningControls } from "@/components/dashboard/HardeningControls";
import { ForceSyncButton } from "@/components/dashboard/ForceSyncButton";
import { UpgradeLock } from "@/components/billing/UpgradeGate";

interface SiteRow {
  id: string;
  url: string;
  maintenance_mode: boolean;
  away_mode_schedule: any;
  site_controls_enabled: boolean;
}

interface FeatureFlags {
  ipBlocking:     boolean;
  geoBlocking:    boolean;
  awayMode:       boolean;
  maintenanceMode: boolean;
}

interface FirewallPageContentProps {
  profile: UserProfile;
  company: Company | null;
  sites?: SiteRow[];
  selectedSiteId?: string | null;
  features?: FeatureFlags;
}

const DEFAULT_FEATURES: FeatureFlags = {
  ipBlocking:     false,
  geoBlocking:    false,
  awayMode:       false,
  maintenanceMode: true,
};

export function FirewallPageContent({
  profile,
  company,
  sites = [],
  selectedSiteId = null,
  features = DEFAULT_FEATURES,
}: FirewallPageContentProps) {
  const [activeTab, setActiveTab] = useState("Site Controls");
  const tabs = ["Site Controls", "Hardening"];

  const selectedSite = selectedSiteId
    ? sites.find((s) => s.id === selectedSiteId) ?? null
    : null;

  const singleSiteMode   = sites.length === 1;
  const forceSyncTarget  = selectedSite ?? (singleSiteMode ? sites[0] : null);

  return (
    <div className="space-y-6">
      <PageHeader title="Firewall & Security" subtitle="Active defense, blocklists, and hardening controls." />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "w-full text-left rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-between",
                activeTab === tab
                  ? "bg-[var(--foreground)] font-medium text-[var(--background)] shadow-sm"
                  : "text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 rounded-2xl border border-[var(--border)] bg-premium-surface p-6 shadow-sm min-h-[400px]">
          <h3 className="text-lg font-semibold mb-6 border-b border-[var(--border)] pb-4">{activeTab}</h3>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === "Site Controls" && (
              <div className="space-y-6">
                {company ? (
                  <>
                    {/* ── Force Sync — global, all features ── */}
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">Force Config Sync</h4>
                      <p className="text-xs text-[var(--muted)] mb-3">
                        Pushes all config changes immediately to the plugin without waiting for the 15-minute cache refresh.
                      </p>
                      {forceSyncTarget ? (
                        <ForceSyncButton siteId={forceSyncTarget.id} siteUrl={forceSyncTarget.url} />
                      ) : sites.length > 1 ? (
                        <div className="space-y-2">
                          {sites.map((s) => (
                            <ForceSyncButton key={s.id} siteId={s.id} siteUrl={s.url} label={`Sync ${s.url}`} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--muted)]">No active sites found.</p>
                      )}
                    </div>

                    {/* ── Maintenance Mode — all plans ── */}
                    {features.maintenanceMode ? (
                      <div className="border-t border-[var(--border)] pt-6">
                        <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                          Maintenance Mode
                          {selectedSite && <span className="ml-2 text-xs font-normal text-[var(--muted)]">— {selectedSite.url}</span>}
                        </h4>
                        <p className="text-xs text-[var(--muted)] mb-4">
                          Show a maintenance page to all non-admin visitors.
                        </p>
                        <MaintenanceModeCard company={company} site={selectedSite ?? undefined} />
                      </div>
                    ) : null}

                    {/* ── Away Mode — Solo+ ── */}
                    <div className="border-t border-[var(--border)] pt-6">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">Away Mode</h4>
                      {features.awayMode ? (
                        <>
                          <p className="text-xs text-[var(--muted)] mb-4">Restrict wp-admin access to specific days and hours.</p>
                          <AwayModeBuilder company={company} site={selectedSite ?? undefined} />
                        </>
                      ) : (
                        <UpgradeLock
                          feature="Away Mode"
                          requiredPlan="Solo"
                          description="Restrict wp-admin access to specific hours and days. Available on Solo plan and above."
                        />
                      )}
                    </div>

                    {/* ── IP Blocking — Solo+ ── */}
                    <div className="border-t border-[var(--border)] pt-6">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">IP Blocking</h4>
                      {features.ipBlocking ? (
                        <>
                          <p className="text-xs text-[var(--muted)] mb-4">Maintain a blocklist of IPs enforced at the WordPress level.</p>
                          <BlockingManager company={company} />
                        </>
                      ) : (
                        <UpgradeLock
                          feature="IP Blocking"
                          requiredPlan="Solo"
                          description="Block specific IP addresses from accessing your WordPress sites. Available on Solo plan and above."
                        />
                      )}
                    </div>

                    {/* ── Geo Blocking — Solo+ ── */}
                    <div className="border-t border-[var(--border)] pt-6">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">Geo Blocking</h4>
                      {features.geoBlocking ? (
                        <>
                          <p className="text-xs text-[var(--muted)] mb-4">Block entire countries from accessing your WordPress site.</p>
                          <GeoBlockingManager company={company} />
                        </>
                      ) : (
                        <UpgradeLock
                          feature="Geo Blocking"
                          requiredPlan="Solo"
                          description="Block traffic from specific countries. Available on Solo plan and above."
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)]">No company data available.</p>
                )}
              </div>
            )}

            {activeTab === "Hardening" && (
              <div className="space-y-4">
                {company ? <HardeningControls company={company} /> : (
                  <p className="text-sm text-[var(--muted)]">No company data available.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}