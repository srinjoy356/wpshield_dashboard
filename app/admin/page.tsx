export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats, getTimeSeriesStats, getSeverityStats, getSitesDownCount } from "@/lib/queries/stats";
import { getAttackEvents } from "@/lib/queries/events";
import { getCompaniesWithTodayStats } from "@/lib/queries/companies";
import { StatCard } from "@/components/dashboard/StatCard";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { CompanyBadge } from "@/components/dashboard/CompanyBadge";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { OverviewCharts } from "@/components/dashboard/OverviewCharts";
import { Users, Zap, Bell, AlertTriangle, ShieldAlert } from "lucide-react";
import { TimeSeriesPoint, SeverityCount } from "@/types";

export default async function AdminOverview() {
  const supabase = createClient();
  
  const [stats, timeData, severityData, attackEvents, companiesWithStats, sitesDownCount] = await Promise.all([
    getDashboardStats(supabase),
    getTimeSeriesStats(supabase),
    getSeverityStats(supabase),
    getAttackEvents(supabase, { limit: 8 }),
    getCompaniesWithTodayStats(supabase),
    getSitesDownCount(supabase),
  ]);

  const totalSeverity = severityData.reduce((a, b) => a + b.value, 0);

  // Sparkline data (static for now, based on real values)
  // Use stable data to avoid hydration mismatches
  const spark = (base: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      value: base + (i % 3 === 0 ? base * 0.05 : 0),
    }));

  // Recent high-severity
  const recentHigh = attackEvents.filter(
    (e) => e.severity === "high" || e.severity === "critical"
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" />
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Active Clients"
          value={stats.activeClients}
          icon={Users}
          sparklineData={spark(stats.activeClients)}
        />
        <StatCard
          label="Events Today"
          value={stats.eventsToday}
          icon={Zap}
          sparklineData={spark(stats.eventsToday)}
        />
        <StatCard
          label="Open Alerts"
          value={stats.openAlerts}
          icon={Bell}
          sparklineData={spark(stats.openAlerts)}
        />
        <StatCard
          label="Sites Down"
          value={
            <span className={sitesDownCount > 0 ? "text-red-500 text-[var(--critical)]" : "text-green-500 text-[var(--success)]"}>
              {sitesDownCount}
            </span>
          }
          icon={ShieldAlert}
          sparklineData={spark(sitesDownCount)}
        />
        <StatCard
          label="Stale Sites"
          value={stats.staleClients}
          icon={AlertTriangle}
          sparklineData={spark(stats.staleClients)}
        />
      </div>
      <OverviewCharts 
        timeData={timeData as TimeSeriesPoint[]} 
        severityData={severityData as SeverityCount[]} 
        totalSeverity={totalSeverity} 
      />

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top attacked clients */}
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-[var(--foreground)]">
            Top onboarded clients
          </h3>
          {companiesWithStats.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-[var(--muted)]">No onboarded clients yet.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)]">
                  <th className="pb-3 font-medium">Company</th>
                  <th className="pb-3 font-medium text-right">Events Today</th>
                  <th className="pb-3 font-medium text-right">Site</th>
                </tr>
              </thead>
              <tbody>
                {companiesWithStats.slice(0, 5).map((c) => (
                  <tr key={c.company_id} className="border-t border-[var(--border)] group hover:bg-[var(--surface-subtle)]/50 transition-colors">
                    <td className="py-3 text-sm font-medium">
                      <a href={`/admin/clients/${c.company_id}`} className="hover:underline flex items-center gap-1">
                        {c.display_name}
                      </a>
                    </td>
                    <td className="py-3 text-right text-sm font-mono font-bold">
                      {c.todayEvents > 0 ? (
                        <span className="text-[var(--info)]">+{c.todayEvents.toLocaleString()}</span>
                      ) : (
                        <span className="text-[var(--muted)]">0</span>
                      )}
                    </td>
                    <td className="py-3 text-right text-xs text-[var(--muted)] truncate max-w-[150px]">
                      {c.firstSiteUrl?.replace(/^https?:\/\//, "") || "N/A"}
                      {c.siteCount > 1 && (
                        <span className="ml-1 text-[var(--info)] font-semibold">+{c.siteCount - 1} more</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent high-severity */}
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-[var(--foreground)]">
            Recent high-severity events
          </h3>
          <div className="max-h-[320px] space-y-3 overflow-y-auto">
            {recentHigh.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[var(--muted)]">No high-severity events yet.</p>
              </div>
            ) : (
              recentHigh.map((e) => (
                <div
                  key={e.id}
                  className="flex items-start gap-3 rounded-lg p-3 hover:bg-[var(--surface-subtle)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TimeCell dateStr={e.occurred_at} className="text-xs" />
                      <CompanyBadge companyId={e.company_id} />
                      <SeverityBadge severity={e.severity} />
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      <span className="uppercase font-medium">{e.pattern_type}</span>
                      {" · "}
                      <span className="font-mono">{e.ip}</span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}