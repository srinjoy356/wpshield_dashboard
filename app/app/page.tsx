export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getClientStats, getTimeSeriesStats, getSeverityStats } from "@/lib/queries/stats";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Package } from "lucide-react";
import { redirect } from "next/navigation";
import { ClientOverviewContent } from "./components/ClientOverviewContent";
import { TimeSeriesPoint, SeverityCount } from "@/types";

export default async function ClientOverview() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") {
      redirect("/admin");
    }
    return (
      <EmptyState
        icon={Package}
        title="No company assigned"
        description="Your account is not yet linked to a company. Please contact support."
      />
    );
  }

  const companyId = profile.company_id;

  const [stats, timeData, severityData, companyUptimeRes, hardeningRes] = await Promise.all([
    getClientStats(supabase, companyId),
    getTimeSeriesStats(supabase, companyId),
    getSeverityStats(supabase, companyId),
    supabase
      .from("companies")
      .select("uptime_status, uptime_response_ms, last_uptime_check, safebrowsing_status, last_safebrowsing_check")
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("wpshield_hardening_results")
      .select("status, score_impact")
      .eq("company_id", companyId),
  ]);

  const companyUptime = companyUptimeRes.data;
  const hardeningScore = hardeningRes.data
    ? hardeningRes.data.reduce((sum, r) => r.status === 'pass' ? sum + r.score_impact : sum, 0)
    : 0;

  // Recent events: combine all 3 tables, take 10 most recent
  const [attackRes, loginRes, fileRes] = await Promise.all([
    supabase
      .from("wpshield_events_attack")
      .select("id, severity, occurred_at, pattern_type, ip")
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase
      .from("wpshield_events_activity")
      .select("id, severity, occurred_at, action_type, user_login, ip")
      .eq("company_id", companyId)
      .in("action_type", ["login_success", "login_failed", "logout"])
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase
      .from("wpshield_events_file")
      .select("id, severity, occurred_at, event, path")
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);

  // Unified recent event shape
  type RecentEvent = {
    id: string;
    severity: string;
    occurred_at: string;
    label: string;
    detail: string;
    type: "attack" | "login" | "file";
  };

  const recentEvents: RecentEvent[] = [
    ...(attackRes.data || []).map((e) => ({
      id: `attack-${e.id}`,
      severity: e.severity,
      opened_at: e.occurred_at, // Map to correct structure key if needed, or stick to occurred_at
      occurred_at: e.occurred_at,
      label: (e.pattern_type as string)?.toUpperCase() ?? "ATTACK",
      detail: e.ip ?? "",
      type: "attack" as const,
    })),
    ...(loginRes.data || []).map((e) => ({
      id: `login-${e.id}`,
      severity: e.severity,
      occurred_at: e.occurred_at,
      label: (e.action_type as string)?.replace("login_", "")?.toUpperCase() ?? "LOGIN",
      detail: e.user_login ?? e.ip ?? "",
      type: "login" as const,
    })),
    ...(fileRes.data || []).map((e) => ({
      id: `file-${e.id}`,
      severity: e.severity,
      occurred_at: e.occurred_at,
      label: (e.event as string)?.toUpperCase() ?? "FILE",
      detail: (e.path as string)?.split("/").pop() ?? "",
      type: "file" as const,
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 10);

  const totalSeverity = severityData.reduce((a, b) => a + b.value, 0);

  // FIX: Format values cleanly to avoid missing fields inside `stats` block
  const resolvedSafebrowsingStatus = companyUptime?.safebrowsing_status ?? "unknown";
  const resolvedLastSafebrowsingCheck = companyUptime?.last_safebrowsing_check ?? null;

  const extendedStats = {
    ...stats,
    safebrowsingStatus: resolvedSafebrowsingStatus,
    lastSafebrowsingCheck: resolvedLastSafebrowsingCheck,
  };

  return (
    <ClientOverviewContent
      companyId={companyId}
      stats={extendedStats}
      timeData={timeData as TimeSeriesPoint[]}
      severityData={severityData as SeverityCount[]}
      totalSeverity={totalSeverity}
      initialCompanyUptime={companyUptime}
      recentEvents={recentEvents}
      hardeningScore={hardeningScore}
      safebrowsingStatus={resolvedSafebrowsingStatus}
      lastSafebrowsingCheck={resolvedLastSafebrowsingCheck}
    />
  );
}