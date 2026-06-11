"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { MarkAllReadButton } from "@/components/dashboard/MarkAllReadButton";
import { Button } from "@/components/ui/button";
import { Alert } from "@/types";
import { ExternalLink, ArrowRight, ArrowLeft } from "lucide-react";
import { TimeCell } from "@/components/dashboard/TimeCell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface CompanySummary {
  company_id: string;
  display_name: string;
  contact_email: string;
  site_url: string;
  open_count: number;
  last_alert_at: string | null;
}

interface AdminAlertsContentProps {
  initialAlerts: Alert[];
  summaries: CompanySummary[];
}

export function AdminAlertsContent({ initialAlerts, summaries }: AdminAlertsContentProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'flat'>('summary');
  const router = useRouter();
  
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          setAlerts((prev) => [newAlert, ...prev]);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
        } else {
          setRealtimeConnected(false);
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [supabase]);
  
  const openCount = alerts.filter(a => a.status === "open").length;

  return (
    <div className="space-y-6">
      <PageHeader 
        title={
          <span className="flex items-center gap-2">
            Alerts
            {realtimeConnected && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </span>
            )}
          </span>
        }
        subtitle="All Companies · Security Alerts"
      >
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setViewMode(viewMode === 'summary' ? 'flat' : 'summary')}
          >
            {viewMode === 'summary' ? (
              <>View all alerts <ArrowRight className="h-4 w-4" /></>
            ) : (
              <><ArrowLeft className="h-4 w-4" /> Back to summary</>
            )}
          </Button>
          <MarkAllReadButton openCount={openCount} />
        </div>
      </PageHeader>

      {viewMode === 'summary' ? (
        <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-hidden">
          {summaries.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[var(--muted)]">No clients onboarded yet. Onboard your first client to start monitoring their alerts.</p>
              <Button asChild variant="link" className="mt-2 text-[var(--foreground)]">
                <Link href="/admin/clients">Go to Clients →</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs text-[var(--muted)] uppercase tracking-wider">
                    <th className="px-6 py-3 font-medium w-12">#</th>
                    <th className="px-6 py-3 font-medium">Company</th>
                    <th className="px-6 py-3 font-medium">Contact Email</th>
                    <th className="px-6 py-3 font-medium text-center">Open Alerts</th>
                    <th className="px-6 py-3 font-medium">Last Alert</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {summaries.map((s, i) => (
                    <tr 
                      key={s.company_id} 
                      className="hover:bg-[var(--surface-subtle)] transition-colors cursor-pointer group"
                      onClick={() => router.push(`/admin/clients/${s.company_id}?tab=alerts`)}
                    >
                      <td className="px-6 py-4 text-xs text-[var(--muted)]">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{s.display_name}</p>
                          <p className="text-xs font-mono text-[var(--muted)]">{s.company_id}</p>
                          {s.site_url && (
                            <a 
                              href={s.site_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {s.site_url.replace(/^https?:\/\//, "")}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--muted)]">{s.contact_email}</td>
                      <td className="px-6 py-4 text-center">
                        {s.open_count > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 border border-red-100">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                            </span>
                            {s.open_count}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--success)] font-medium flex items-center justify-center gap-1">
                            All clear ✓
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {s.last_alert_at ? (
                          <TimeCell dateStr={s.last_alert_at} className="text-sm" />
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          size="sm" 
                          className="h-8 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <AlertsList initialAlerts={alerts} isAdmin={true} showCompanyFilter={true} />
      )}
    </div>
  );
}
