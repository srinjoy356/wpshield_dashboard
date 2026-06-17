export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getClientStats, getTimeSeriesStats, getSeverityStats } from "@/lib/queries/stats";
import { getCheckTargets } from "@/lib/queries/site-targets";
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

  const [stats, timeData, severityData, companyRes] = await Promise.all([
    getClientStats(supabase, companyId),
    getTimeSeriesStats(supabase, companyId),
    getSeverityStats(supabase, companyId),
    supabase
      .from("companies")
      .select(
        "site_url, last_seen_at, uptime_status, uptime_response_ms, last_uptime_check, safebrowsing_status, last_safebrowsing_check"
      )
      .eq("company_id", companyId)
      .single(),
  ]);

  const company = companyRes.data;

  // Resolve every active site under this company (or the legacy single site_url if
  // none have been activated yet) — this single list now drives both the uptime/
  // safe-browsing rollup and the hardening score below, instead of each reading a
  // single shared companies row that only ever reflected one site.
  const targets = await getCheckTargets(supabase, { company_id: companyId, ...company });

  // Aggregate uptime: "down" if any site is down (worst case is what matters for an
  // at-a-glance status), "up" only if every site that's reported a status is up,
  // otherwise "unknown". Response time and last-checked are averaged/most-recent
  // across whichever sites have reported one.
  const uptimeStatuses = targets.map((t) => t.uptime_status).filter(Boolean) as string[];
  const aggregateUptimeStatus = uptimeStatuses.includes("down")
    ? "down"
    : uptimeStatuses.length > 0 && uptimeStatuses.every((s) => s === "up")
      ? "up"
      : "unknown";
  const responseTimes = targets.map((t) => t.uptime_response_ms).filter((v): v is number => v != null);
  const aggregateResponseMs =
    responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
  const uptimeCheckTimes = targets.map((t) => t.last_uptime_check).filter(Boolean) as string[];
  const aggregateLastUptimeCheck =
    uptimeCheckTimes.length > 0
      ? uptimeCheckTimes.reduce((latest, c) => (new Date(c) > new Date(latest) ? c : latest))
      : null;
  const sitesUpCount = targets.filter((t) => t.uptime_status === "up").length;

  const safebrowsingStatuses = targets.map((t) => t.safebrowsing_status).filter(Boolean) as string[];
  const aggregateSafebrowsingStatus = safebrowsingStatuses.includes("blacklisted")
    ? "blacklisted"
    : safebrowsingStatuses.length > 0 && safebrowsingStatuses.every((s) => s === "clean")
      ? "clean"
      : "unknown";
  const safebrowsingCheckTimes = targets.map((t) => t.last_safebrowsing_check).filter(Boolean) as string[];
  const aggregateLastSafebrowsingCheck =
    safebrowsingCheckTimes.length > 0
      ? safebrowsingCheckTimes.reduce((latest, c) => (new Date(c) > new Date(latest) ? c : latest))
      : null;

  // Hardening score: average each site's own 0-100 score, not a sum across every row
  // for the company — summing was double (or N-times) counting once a company had
  // more than one site, since each site has its own full set of check rows now.
  const perSiteScores = await Promise.all(
    targets.map(async (t) => {
      let q = supabase.from("wpshield_hardening_results").select("status, score_impact").eq("company_id", companyId);
      q = t.site_id ? q.eq("site_id", t.site_id) : q.is("site_id", null);
      const { data } = await q;
      return (data || []).reduce((sum, r) => (r.status === "pass" ? sum + (r.score_impact || 0) : sum), 0);
    })
  );
  const hardeningScore =
    perSiteScores.length > 0 ? Math.round(perSiteScores.reduce((a, b) => a + b, 0) / perSiteScores.length) : 0;

  // Recent events: combine all 3 tables, take 10 most recent. site_url is already
  // returned by select("*") on each underlying table — just carrying it through to
  // the UI now instead of dropping it, so a multi-site company can tell which site
  // each event actually came from.
  const [attackRes, loginRes, fileRes] = await Promise.all([
    supabase
      .from("wpshield_events_attack")
      .select("id, severity, occurred_at, pattern_type, ip, site_url")
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase
      .from("wpshield_events_activity")
      .select("id, severity, occurred_at, action_type, user_login, ip, site_url")
      .eq("company_id", companyId)
      .in("action_type", ["login_success", "login_failed", "logout"])
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase
      .from("wpshield_events_file")
      .select("id, severity, occurred_at, event, path, site_url")
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
    site_url: string | null;
    type: "attack" | "login" | "file";
  };

  const recentEvents: RecentEvent[] = [
    ...(attackRes.data || []).map((e) => ({
      id: `attack-${e.id}`,
      severity: e.severity,
      occurred_at: e.occurred_at,
      label: (e.pattern_type as string)?.toUpperCase() ?? "ATTACK",
      detail: e.ip ?? "",
      site_url: e.site_url ?? null,
      type: "attack" as const,
    })),
    ...(loginRes.data || []).map((e) => ({
      id: `login-${e.id}`,
      severity: e.severity,
      occurred_at: e.occurred_at,
      label: (e.action_type as string)?.replace("login_", "")?.toUpperCase() ?? "LOGIN",
      detail: e.user_login ?? e.ip ?? "",
      site_url: e.site_url ?? null,
      type: "login" as const,
    })),
    ...(fileRes.data || []).map((e) => ({
      id: `file-${e.id}`,
      severity: e.severity,
      occurred_at: e.occurred_at,
      label: (e.event as string)?.toUpperCase() ?? "FILE",
      detail: (e.path as string)?.split("/").pop() ?? "",
      site_url: e.site_url ?? null,
      type: "file" as const,
    })),
  ]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 10);

  const totalSeverity = severityData.reduce((a, b) => a + b.value, 0);

  return (
    <ClientOverviewContent
      companyId={companyId}
      stats={stats}
      timeData={timeData as TimeSeriesPoint[]}
      severityData={severityData as SeverityCount[]}
      totalSeverity={totalSeverity}
      initialUptime={{
        status: aggregateUptimeStatus,
        responseMs: aggregateResponseMs,
        lastCheck: aggregateLastUptimeCheck,
      }}
      sitesSummary={{ total: targets.length, up: sitesUpCount }}
      recentEvents={recentEvents}
      hardeningScore={hardeningScore}
      safebrowsingStatus={aggregateSafebrowsingStatus}
      lastSafebrowsingCheck={aggregateLastSafebrowsingCheck}
    />
  );
}