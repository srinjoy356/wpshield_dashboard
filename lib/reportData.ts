import { SupabaseClient } from "@supabase/supabase-js";
import { getCheckTargets } from "./queries/site-targets";

const getMaturityLabel = (s: number) => {
  if (s <= 40) return "Critical Risk";
  if (s <= 60) return "Needs Attention";
  if (s <= 80) return "Moderate";
  if (s <= 90) return "Good";
  return "Excellent";
};

export async function getReportData(supabase: SupabaseClient, companyId: string, periodDays: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  const startDateIso = startDate.toISOString();

  // 1. Fetch Company Info
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("display_name, site_url, last_seen_at")
    .eq("company_id", companyId)
    .single();

  if (companyError || !company) {
    throw new Error("Company not found");
  }

  // Resolve every active site this report should cover, and build a lookup from
  // site_id ("legacy" for the null/fallback case) to its URL — used below to label
  // every per-row table with the specific site it came from, instead of a report
  // that silently mixes data from multiple sites with no way to tell them apart.
  const targets = await getCheckTargets(supabase, { company_id: companyId, site_url: company.site_url });
  const siteUrlByKey = new Map<string, string>();
  targets.forEach((t) => siteUrlByKey.set(t.site_id ?? "legacy", t.url));
  const urlFor = (siteId: string | null | undefined) => siteUrlByKey.get(siteId ?? "legacy") ?? null;

  // 2. Fetch Stats counts — these are legitimate company-wide totals across every
  //    site, not something that needed per-site scoping.
  const { count: attackCount } = await supabase.from("wpshield_events_attack").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("occurred_at", startDateIso);
  const { count: loginCount } = await supabase.from("wpshield_events_login").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("occurred_at", startDateIso);
  const { count: fileCount } = await supabase.from("wpshield_events_file").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("occurred_at", startDateIso);
  const { count: openAlertCount } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open");

  // 3. Fetch Vulnerable Plugins — labeled with which site each one is on, since the
  //    same plugin could be vulnerable on one site and already patched on another.
  const { data: vulnAlertsRaw } = await supabase.from("wpshield_vuln_alerts").select("plugin_name, plugin_version, cve_id, severity, fixed_in, site_id").eq("company_id", companyId).eq("status", "open").order("created_at", { ascending: false });
  const vulnerablePlugins = (vulnAlertsRaw || []).map((v) => ({ ...v, site_url: urlFor(v.site_id) }));

  // 4. Top 5 attacking IPs — intentionally stays a company-wide aggregate. An IP
  //    hitting two sites under the same company is still the same threat actor; this
  //    mirrors the threat-intel cron job's cross-site correlation design rather than
  //    needing its own per-site breakdown.
  const { data: rawAttacks } = await supabase.from("wpshield_events_attack").select("ip, pattern_type").eq("company_id", companyId).gte("occurred_at", startDateIso);
  const ipCounts = new Map<string, { ip: string; count: number; pattern_type: string }>();
  for (const att of (rawAttacks || [])) {
    if (!att.ip) continue;
    const existing = ipCounts.get(att.ip);
    if (existing) existing.count++;
    else ipCounts.set(att.ip, { ip: att.ip, count: 1, pattern_type: att.pattern_type || "unknown" });
  }
  const topAttackingIps = Array.from(ipCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5);

  // 5. Recent 5 file changes — site_url is already a raw column on this table from
  //    the original ingest, so this is just selecting one more existing field.
  const { data: fileChanges } = await supabase.from("wpshield_events_file").select("path, event, occurred_at, site_url").eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(5);

  // 6. Failed hardening checks — same check (e.g. "HTTPS Enforced") can now fail
  //    independently on different sites, so each row needs its own site label or
  //    two genuinely different failures would look like an unexplained duplicate.
  const { data: failedChecksRaw } = await supabase.from("wpshield_hardening_results").select("check_name, priority, recommendation, site_id").eq("company_id", companyId).eq("status", "fail");
  const failedChecks = (failedChecksRaw || []).map((c) => ({ ...c, site_url: urlFor(c.site_id) }));

  // 7. Hardening score — averaged per site (not summed across every row for the
  //    company; summing could exceed 100 once a company had more than one site,
  //    each with its own full set of up to 7 passing checks), plus the full per-site
  //    breakdown so the report can show each site's own score, not just one blended
  //    number that hides which specific site is actually the weak link.
  const { data: hardeningRows } = await supabase
    .from("wpshield_hardening_results")
    .select("site_id, status, score_impact")
    .eq("company_id", companyId);

  const scoresBySite = new Map<string, number>();
  for (const row of hardeningRows || []) {
    const key = row.site_id ?? "legacy";
    if (row.status === "pass") {
      scoresBySite.set(key, (scoresBySite.get(key) || 0) + (row.score_impact || 0));
    } else if (!scoresBySite.has(key)) {
      scoresBySite.set(key, 0);
    }
  }

  const sites = targets.map((t) => {
    const key = t.site_id ?? "legacy";
    const siteScore = scoresBySite.get(key) ?? 0;
    return { url: t.url, score: siteScore, maturity: getMaturityLabel(siteScore) };
  });

  const siteScoreValues = sites.map((s) => s.score);
  const score = siteScoreValues.length > 0 ? Math.round(siteScoreValues.reduce((a, b) => a + b, 0) / siteScoreValues.length) : 0;

  // 8. Fetch Managed Review (Analyst Notes)
  const currentMonthYear = new Date().toISOString().slice(0, 7);
  const { data: reviewData } = await supabase
    .from("managed_reviews")
    .select("vulnerable_plugins_note, failed_hardening_note, suspicious_logins_note, status")
    .eq("company_id", companyId)
    .eq("month_year", currentMonthYear)
    .single();

  return {
    company: {
      display_name: company.display_name,
      site_url: company.site_url,
      last_seen_at: company.last_seen_at || "",
    },
    // Every site this report covers, each with its own independent score — a
    // single-site company gets an array of length 1, so nothing downstream needs a
    // separate code path for "do I have multiple sites or not."
    sites,
    period: `Last ${periodDays} Days`,
    generatedAt: new Date().toISOString(),
    maturity: { score, label: getMaturityLabel(score) },
    stats: {
      totalAttacks: attackCount || 0,
      totalLogins: loginCount || 0,
      totalFileChanges: fileCount || 0,
      openAlerts: openAlertCount || 0,
    },
    vulnerablePlugins,
    topAttackingIps,
    recentFileChanges: fileChanges || [],
    failedChecks,
    analystReview: reviewData || null,
  };
}