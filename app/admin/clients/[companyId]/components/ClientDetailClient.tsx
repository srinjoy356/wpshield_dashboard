"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatusDot } from "@/components/dashboard/StatusDot";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { ExternalLink, Mail, Calendar, Activity, ShieldAlert, LogIn, FileCode, Package, LayoutDashboard, Edit, KeyRound, UserX, Trash2, UserCheck, ArrowLeft } from "lucide-react";
import { Company, AttackEvent, LoginEvent, FileEvent, Alert, InventorySnapshotView } from "@/types";

// Shared Components
import { AttacksTable } from "@/components/dashboard/AttacksTable";
import { LoginsTable } from "@/components/dashboard/LoginsTable";
import { FilesTable } from "@/components/dashboard/FilesTable";
import { InventoryList } from "@/components/dashboard/InventoryList";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { OverviewCharts } from "@/components/dashboard/OverviewCharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { AlertsList } from "@/components/dashboard/AlertsList";

// Admin Modals
import { ClientEditModal } from "./ClientEditModal";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { DeleteClientModal } from "./DeleteClientModal";
import { SuspendConfirmModal } from "./SuspendConfirmModal";

interface ClientDetailClientProps {
  company: Company & { stats: any };
  attacks: AttackEvent[];
  logins: LoginEvent[];
  files: FileEvent[];
  inventory: InventorySnapshotView | null;
  alerts: Alert[];
  timeData: any[];
  severityData: any[];
  defaultTab?: string;
}

export function ClientDetailClient({
  company,
  attacks,
  logins,
  files,
  inventory,
  alerts,
  timeData,
  severityData,
  defaultTab = "overview",
}: ClientDetailClientProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const router = useRouter();
  
  // Modal states
  const [showEdit, setShowEdit] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const totalSeverity = severityData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-6 pb-12">
      {defaultTab === 'alerts' && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-1.5 -ml-2 text-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={() => router.push('/admin/alerts')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Alerts
        </Button>
      )}
      <PageHeader title={company.display_name} />

      {/* TOP: Company header card */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x border-[var(--border)]">
          {/* Left side: Info */}
          <div className="flex-1 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">{company.display_name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs font-mono bg-[var(--surface-subtle)] px-1.5 py-0.5 rounded text-[var(--muted)]">
                    {company.company_id}
                  </code>
                  {company.site_url && (
                    <a 
                      href={company.site_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
                    >
                      {company.site_url.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={company.status} />
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  {company.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Mail className="h-4 w-4" />
                <span>{company.contact_email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Calendar className="h-4 w-4" />
                <span>Onboarded: <TimeCell dateStr={company.onboarded_at} className="inline" /></span>
              </div>
            </div>

            {company.notes && (
              <div className="text-sm italic text-[var(--muted)] bg-[var(--surface-subtle)] p-3 rounded-lg border-l-2 border-[var(--border)]">
                "{company.notes}"
              </div>
            )}
          </div>

          {/* Right side: Quick Stats */}
          <div className="w-full md:w-80 p-6 bg-[var(--surface-subtle)]/30">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-widest mb-1">Last Seen</p>
                <div className="text-sm font-medium">
                  <TimeCell dateStr={company.last_seen_at} />
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-widest mb-1">Total Events</p>
                <p className="text-lg font-mono font-bold">{(company.stats?.total || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-widest mb-1">Open Alerts</p>
                <p className={`text-lg font-mono font-bold ${company.stats?.alerts > 0 ? "text-[var(--critical)]" : ""}`}>
                  {company.stats?.alerts || 0}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[var(--muted)] tracking-widest mb-1">Sites</p>
                <p className="text-lg font-mono font-bold text-[var(--info)]">1</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin action bar */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
          <Edit className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Edit Details
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowReset(true)}>
          <KeyRound className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Reset Password
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className={company.status === "suspended" ? "text-green-600 hover:text-green-700" : "text-amber-600 hover:text-amber-700"}
          onClick={() => setShowSuspend(true)}
        >
          {company.status === "suspended" ? (
            <><UserCheck className="mr-2 h-4 w-4" strokeWidth={1.5} /> Unsuspend</>
          ) : (
            <><UserX className="mr-2 h-4 w-4" strokeWidth={1.5} /> Suspend</>
          )}
        </Button>
        <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setShowDelete(true)}>
          <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
          Delete Client
        </Button>
      </div>

      {/* Tabs section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-surface border border-[var(--border)] p-1 rounded-xl">
          <TabsTrigger value="overview" className="gap-2 rounded-lg data-[state=active]:bg-[var(--surface-subtle)]">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="attacks" className="gap-2 rounded-lg data-[state=active]:bg-[var(--surface-subtle)]">
            <ShieldAlert className="h-4 w-4" /> Attacks ({attacks.length})
          </TabsTrigger>
          <TabsTrigger value="logins" className="gap-2 rounded-lg data-[state=active]:bg-[var(--surface-subtle)]">
            <LogIn className="h-4 w-4" /> Logins ({logins.length})
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2 rounded-lg data-[state=active]:bg-[var(--surface-subtle)]">
            <FileCode className="h-4 w-4" /> Files ({files.length})
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2 rounded-lg data-[state=active]:bg-[var(--surface-subtle)]">
            <Package className="h-4 w-4" /> Inventory
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 rounded-lg data-[state=active]:bg-[var(--surface-subtle)]">
            <Activity className="h-4 w-4" /> Alerts ({alerts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Attacks (7d)" value={attacks.length} icon={ShieldAlert} />
            <StatCard label="Logins (7d)" value={logins.length} icon={LogIn} />
            <StatCard label="File Events" value={files.length} icon={FileCode} />
            <StatCard label="Open Alerts" value={alerts.filter(a => a.status === 'open').length} icon={Activity} />
          </div>

          <OverviewCharts 
            timeData={timeData} 
            severityData={severityData} 
            totalSeverity={totalSeverity} 
          />

          <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm">
            <h3 className="text-base font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {[...attacks, ...logins, ...files]
                .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                .slice(0, 5)
                .map((e: any, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0 border-[var(--border)]">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${
                        'pattern_type' in e ? "bg-red-50 text-red-600" : 
                        'login' in e ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {'pattern_type' in e ? <ShieldAlert className="h-3.5 w-3.5" /> : 
                         'login' in e ? <LogIn className="h-3.5 w-3.5" /> : <FileCode className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <p className="font-medium">
                          {'pattern_type' in e ? `${e.pattern_type} Attack` : 
                           'login' in e ? `Login: ${e.login}` : `File: ${e.event}`}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {'ip' in e ? e.ip : 'path' in e ? e.path : "N/A"}
                        </p>
                      </div>
                    </div>
                    <TimeCell dateStr={e.occurred_at} className="text-xs text-[var(--muted)]" />
                  </div>
                ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attacks" className="outline-none">
          <AttacksTable initialEvents={attacks} />
        </TabsContent>

        <TabsContent value="logins" className="outline-none">
          <LoginsTable initialEvents={logins} />
        </TabsContent>

        <TabsContent value="files" className="outline-none">
          <FilesTable initialEvents={files} />
        </TabsContent>

        <TabsContent value="inventory" className="outline-none">
          <InventoryList snapshot={inventory} />
        </TabsContent>

        <TabsContent value="alerts" className="outline-none">
          <AlertsList initialAlerts={alerts} isAdmin={true} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ClientEditModal company={company} open={showEdit} onOpenChange={setShowEdit} />
      <ResetPasswordModal company={company} open={showReset} onOpenChange={setShowReset} />
      <SuspendConfirmModal company={company} open={showSuspend} onOpenChange={setShowSuspend} />
      <DeleteClientModal company={company} open={showDelete} onOpenChange={setShowDelete} />
    </div>
  );
}
