"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { ChangePasswordForm } from "@/components/dashboard/ChangePasswordForm";
import { UserProfile, Company } from "@/types";
import { cn } from "@/lib/utils";

// Feature components moved to Firewall
import { NotificationSettings } from "@/components/dashboard/NotificationSettings";

interface SettingsPageContentProps {
  profile: UserProfile;
  company: Company | null;
}

export function SettingsPageContent({ profile, company }: SettingsPageContentProps) {
  const [activeTab, setActiveTab] = useState("Account");
  const tabs = ["Account", "Change Password", "Notification Preferences"];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Manage your account preferences" />
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
            {activeTab === "Account" && (
              <SettingsForm profile={profile} company={company} />
            )}
            
            {activeTab === "Change Password" && (
              <ChangePasswordForm />
            )}
            
            {/* Live Notification Preferences Tab */}
            {activeTab === "Notification Preferences" && (
              <div className="space-y-4">
                {company ? (
                  <NotificationSettings company={company} />
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