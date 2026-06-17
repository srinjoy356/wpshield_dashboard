"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { OverviewCharts } from "@/components/dashboard/OverviewCharts";
import { Zap, Bell, Activity, Clock, Swords, KeyRound, FileSearch, Package, Shield } from "lucide-react";
import { TimeSeriesPoint, SeverityCount } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface RecentEvent {
  id: string;
  severity: string;
  occurred_at: string;
  label: string;
  detail: string;
  site_url: string | null;
  type: "attack" | "login" | "file";
}

interface ClientOverviewContentProps {
  companyId: string;
  stats: {
    eventsToday: number;
    openAlerts: number;
    attacksToday: number;
    loginsToday: number;
    filesToday: number;
    inventoryToday: number;
    lastSeen: string | null;
  };
  timeData: TimeSeriesPoint[];
  severityData: SeverityCount[];
  totalSeverity: number;
  // Already aggregated across every active site under this company (worst-case for
  // status, most-recent for the check time) — not a single shared companies row,
  // which stops being updated once a company has activated any real site.
  initialUptime: {
    status: string;
    responseMs: number;
    lastCheck: string | null;
  };
  sitesSummary: { total: number; up: number };
  recentEvents: RecentEvent[];
  hardeningScore: number;
  safebrowsingStatus: string;
  lastSafebrowsingCheck: string | null;
}

export function ClientOverviewContent({
  companyId,
  stats,
  timeData,
  severityData,
  totalSeverity,
  initialUptime,
  sitesSummary,
  recentEvents,
  hardeningScore,
  safebrowsingStatus,
  lastSafebrowsingCheck
}: ClientOverviewContentProps) {
  const supabase = useMemo(() => createClient(), []);

  const [uptimeStatus, setUptimeStatus] = useState(initialUptime.status);
  const [uptimeResponseMs, setUptimeResponseMs] = useState(initialUptime.responseMs);
  const [lastUptimeCheck, setLastUptimeCheck] = useState(initialUptime.lastCheck);
  const [sitesUp, setSitesUp] = useState(sitesSummary.up);
  const [sitesTotal, setSitesTotal] = useState(sitesSummary.total);

  const [liveEvents, setLiveEvents] = useState<RecentEvent[]>(recentEvents);

  // Recomputes the same worst-case-wins rollup used on first load — any update to
  // a site's status (or, for legacy companies with no real sites yet, the company
  // row itself) re-derives the aggregate rather than overwriting it with whatever
  // single row happened to change, which would be wrong the moment more than one
  // site exists.
  const refreshUptimeRollup = async () => {
    const { data: activeSites } = await supabase
      .from("sites")
      .select("uptime_status, uptime_response_ms, last_uptime_check")
      .eq("company_id", companyId)
      .eq("is_active", true);

    let rows = activeSites || [];
    if (rows.length === 0) {
      const { data: company } = await supabase
        .from("companies")
        .select("uptime_status, uptime_response_ms, last_uptime_check")
        .eq("company_id", companyId)
        .single();
      rows = company ? [company] : [];
    }

    const statuses = rows.map((r) => r.uptime_status).filter(Boolean) as string[];
    setUptimeStatus(
      statuses.includes("down") ? "down" : statuses.length > 0 && statuses.every((s) => s === "up") ? "up" : "unknown"
    );
    const responseTimes = rows.map((r) => r.uptime_response_ms).filter((v): v is number => v != null);
    setUptimeResponseMs(
      responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0
    );
    const checkTimes = rows.map((r) => r.last_uptime_check).filter(Boolean) as string[];
    setLastUptimeCheck(
      checkTimes.length > 0 ? checkTimes.reduce((latest, c) => (new Date(c) > new Date(latest) ? c : latest)) : null
    );
    setSitesUp(rows.filter((r) => r.uptime_status === "up").length);
    setSitesTotal(rows.length);
  };

  useEffect(() => {
    const channel = supabase
      .channel("company-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sites", filter: `company_id=eq.${companyId}` },
        () => { refreshUptimeRollup(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "companies", filter: `company_id=eq.${companyId}` },
        () => { refreshUptimeRollup(); }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wpshield_events_attack",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const newAttack = payload.new as any;
          const newEvent: RecentEvent = {
            id: `attack-${newAttack.id}`,
            severity: newAttack.severity,
            occurred_at: newAttack.occurred_at,
            label: (newAttack.pattern_type as string)?.toUpperCase() ?? "ATTACK",
            detail: newAttack.ip ?? "",
            site_url: newAttack.site_url ?? null,
            type: "attack",
          };
          setLiveEvents(prev => [newEvent, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, companyId]);

  let statusText = "Unknown";
  let statusColor = "text-gray-400";
  let dotColor = "bg-gray-400";

  if (uptimeStatus === "up") {
    statusText = "Online";
    statusColor = "text-green-500 text-[var(--success)]";
    dotColor = "bg-green-500 bg-[var(--success)]";
  } else if (uptimeStatus === "down") {
    statusText = "Offline";
    statusColor = "text-red-500 text-[var(--critical)]";
    dotColor = "bg-red-500 bg-[var(--critical)]";
  }

  let checkedText = "never checked";
  if (lastUptimeCheck) {
    const checkTime = new Date(lastUptimeCheck).getTime();
    const diffMs = Date.now() - checkTime;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
      checkedText = "checked just now";
    } else {
      checkedText = `checked ${diffMins} min ago`;
    }
  }

  const hardeningData = useMemo(() => {
    let maturity = "Unknown";
    let colorClass = "text-gray-400";
    
    if (hardeningScore <= 40) maturity = "Critical Risk";
    else if (hardeningScore <= 60) maturity = "Needs Attention";
    else if (hardeningScore <= 80) maturity = "Moderate";
    else if (hardeningScore <= 90) maturity = "Good";
    else maturity = "Excellent";

    if (hardeningScore < 60) {
      colorClass = "text-red-500 text-[var(--critical)]";
    } else if (hardeningScore <= 80) {
      colorClass = "text-orange-500 text-amber-500";
    } else {
      colorClass = "text-green-500 text-[var(--success)]";
    }

    return { maturity, colorClass };
  }, [hardeningScore]);

  const safeBrowsingBadge = useMemo(() => {
    if (safebrowsingStatus === "blacklisted") {
      return {
        label: "BLACKLISTED",
        dotColor: "bg-red-500",
        textColor: "text-red-500",
        description: "Google Safe Browsing has flagged this site",
      };
    }
    if (safebrowsingStatus === "clean") {
      return {
        label: "Clean",
        dotColor: "bg-green-500",
        textColor: "text-green-500",
        description: "No threats detected",
      };
    }
    return {
      label: "Unknown",
      dotColor: "bg-gray-400",
      textColor: "text-gray-400",
      description: "Not yet checked",
    };
  }, [safebrowsingStatus]);

  const safeBrowsingCheckedText = useMemo(() => {
    if (!lastSafebrowsingCheck) return "never checked";
    const diffMs = Date.now() - new Date(lastSafebrowsingCheck).getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return "checked recently";
    if (diffHours < 24) return `checked ${diffHours}h ago`;
    return `checked ${Math.floor(diffHours / 24)}d ago`;
  }, [lastSafebrowsingCheck]);

  const spark = (base: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      value: base + (i % 2 === 0 ? base * 0.02 : 0),
    }));

  const quickActions = [
    { label: "View Attacks", icon: Swords, href: "/app/attacks", count: stats.attacksToday },
    { label: "View Logins", icon: KeyRound, href: "/app/logins", count: stats.loginsToday },
    { label: "View File Changes", icon: FileSearch, href: "/app/files", count: stats.filesToday },
    { label: "View Inventory", icon: Package, href: "/app/inventory", count: stats.inventoryToday },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle={`${companyId} · Dashboard`} />

      {/* Grid updated to xl:grid-cols-6 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="My Events Today"
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
          label="Site Status"
          value={
            <span className="block space-y-1">
              <span className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full shrink-0 ${dotColor}`} />
                <span className={`text-2xl font-bold ${statusColor}`}>{statusText}</span>
              </span>
              <span className="block text-xs font-medium text-[var(--muted)]">
                {uptimeStatus === "unknown" ? "No response data" : `${uptimeResponseMs}ms response`}
              </span>
              {sitesTotal > 1 && (
                <span className="block text-xs font-medium text-[var(--muted)]">
                  {sitesUp}/{sitesTotal} sites up
                </span>
              )}
            </span>
          }
          delta={checkedText}
          deltaType="neutral"
          icon={Activity}
        />
        <Link href="/app/hardening" className="block group">
          <StatCard
            label="Hardening Score"
            value={
              <span className="block space-y-1">
                <span className="flex items-center gap-1.5">
                  <span className={`text-2xl font-bold ${hardeningData.colorClass}`}>{hardeningScore}</span>
                  <span className="text-xs font-semibold text-[var(--muted)]">/ 100</span>
                </span>
                <span className="block text-xs font-medium text-[var(--muted)]">
                  {hardeningData.maturity}
                </span>
              </span>
            }
            className="group-hover:border-[#2DD4BF] transition-all duration-200 cursor-pointer h-full"
            icon={Shield}
          />
        </Link>
        <StatCard
          label="Last Plugin Heartbeat"
          value={stats.lastSeen ? <TimeCell dateStr={stats.lastSeen} /> : "Never"}
          icon={Clock}
        />
        <StatCard
          label="Safe Browsing"
          value={
            <span className="block space-y-1">
              <span className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full shrink-0 ${safeBrowsingBadge.dotColor}`} />
                <span className={`text-xl font-bold ${safeBrowsingBadge.textColor}`}>
                  {safeBrowsingBadge.label}
                </span>
              </span>
              <span className="block text-xs font-medium text-[var(--muted)]">
                {safeBrowsingBadge.description}
              </span>
            </span>
          }
          delta={safeBrowsingCheckedText}
          deltaType="neutral"
          icon={Shield}
        />
      </div>

      <OverviewCharts
        timeData={timeData}
        severityData={severityData}
        totalSeverity={totalSeverity}
      />

      {/* Recent events */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold">Recent events</h3>
        <div className="space-y-3">
          {liveEvents.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-4 text-center">No security events recorded yet.</p>
          ) : (
            liveEvents.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-lg p-3 hover:bg-[var(--surface-subtle)]"
              >
                <SeverityBadge severity={e.severity as any} />
                <span className="text-sm uppercase font-medium text-[var(--muted)]">
                  {e.label}
                </span>
                <span className="font-mono text-xs text-[var(--muted)] truncate max-w-[200px]">{e.detail}</span>
                {e.site_url && (
                  <span className="text-xs text-[var(--muted)] truncate max-w-[160px] italic">{e.site_url}</span>
                )}
                <span className="ml-auto shrink-0">
                  <TimeCell dateStr={e.occurred_at} className="text-xs" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((qa) => (
          <Link
            key={qa.href}
            href={qa.href}
            className="group rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm hover:bg-[var(--surface-subtle)] transition-colors"
          >
            <qa.icon className="h-6 w-6 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm font-semibold">{qa.label}</p>
            <p className="text-xs text-[var(--muted)]">{qa.count} events today</p>
          </Link>
        ))}
      </div>
    </div>
  );
}