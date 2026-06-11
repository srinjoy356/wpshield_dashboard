"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { UserProfile, Company } from "@/types";
import { cn } from "@/lib/utils";

// Feature components
import { MaintenanceModeCard } from "@/components/dashboard/MaintenanceModeCard";
import { AwayModeBuilder } from "@/components/dashboard/AwayModeBuilder";
import { BlockingManager } from "@/components/dashboard/BlockingManager";
import { GeoBlockingManager } from "@/components/dashboard/GeoBlockingManager";
import { HardeningControls } from "@/components/dashboard/HardeningControls";

interface FirewallPageContentProps {
  profile: UserProfile;
  company: Company | null;
}

export function FirewallPageContent({ profile, company }: FirewallPageContentProps) {
  const [activeTab, setActiveTab] = useState("Site Controls");
  const tabs = ["Site Controls", "Hardening"];

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
        <div className="flex-1 rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm min-h-[400px]">
          <h3 className="text-lg font-semibold mb-6 border-b border-[var(--border)] pb-4">{activeTab}</h3>
          
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === "Site Controls" && (
              <div className="space-y-6">
                {company ? (
                  <>
                    {/* Feature 1: Maintenance Mode */}
                    <MaintenanceModeCard company={company} />

                    {/* Feature 2: Away Mode */}
                    <div className="border-t border-[var(--border)] pt-6">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                        Away Mode
                      </h4>
                      <p className="text-xs text-[var(--muted)] mb-4">
                        Restrict wp-admin access to specific days and hours.
                      </p>
                      <AwayModeBuilder company={company} />
                    </div>
                    
                    {/* Feature 3: Active Blocking */}
                    <div className="border-t border-[var(--border)] pt-6">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                        IP Blocking
                      </h4>
                      <p className="text-xs text-[var(--muted)] mb-4">
                        Maintain a blocklist of IPs and enforce it at the WordPress level.
                      </p>
                      <BlockingManager company={company} />
                    </div>
                    
                    {/* Feature 4: Geo Blocking */}
                    <div className="border-t border-[var(--border)] pt-6">
                      <h4 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                        Geo Blocking
                      </h4>
                      <p className="text-xs text-[var(--muted)] mb-4">
                        Block entire countries from accessing your WordPress site.
                      </p>
                      <GeoBlockingManager company={company} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)]">No company data available.</p>
                )}
              </div>
            )}

            {activeTab === "Hardening" && (
              <div className="space-y-4">
                {company ? (
                  <HardeningControls company={company} />
                ) : (
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
