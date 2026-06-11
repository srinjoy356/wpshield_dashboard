import { SupabaseClient } from "@supabase/supabase-js";

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

  // 2. Fetch Stats counts
  const { count: attackCount } = await supabase.from("wpshield_events_attack").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("occurred_at", startDateIso);
  const { count: loginCount } = await supabase.from("wpshield_events_login").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("occurred_at", startDateIso);
  const { count: fileCount } = await supabase.from("wpshield_events_file").select("*", { count: "exact", head: true }).eq("company_id", companyId).gte("occurred_at", startDateIso);
  const { count: openAlertCount } = await supabase.from("alerts").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "open");

  // 3. Fetch Vulnerable Plugins
  const { data: vulnAlerts } = await supabase.from("wpshield_vuln_alerts").select("plugin_name, plugin_version, cve_id, severity, fixed_in").eq("company_id", companyId).eq("status", "open").order("created_at", { ascending: false });

  // 4. Top 5 attacking IPs
  const { data: rawAttacks } = await supabase.from("wpshield_events_attack").select("ip, pattern_type").eq("company_id", companyId).gte("occurred_at", startDateIso);
  const ipCounts = new Map<string, { ip: string; count: number; pattern_type: string }>();
  for (const att of (rawAttacks || [])) {
    if (!att.ip) continue;
    const existing = ipCounts.get(att.ip);
    if (existing) existing.count++;
    else ipCounts.set(att.ip, { ip: att.ip, count: 1, pattern_type: att.pattern_type || "unknown" });
  }
  const topAttackingIps = Array.from(ipCounts.values()).sort((a, b) => b.count - a.count).slice(0, 5);

  // 5. Recent 5 file changes
  const { data: fileChanges } = await supabase.from("wpshield_events_file").select("path, event, occurred_at").eq("company_id", companyId).order("occurred_at", { ascending: false }).limit(5);

  // 6. Failed hardening checks
  const { data: failedChecks } = await supabase.from("wpshield_hardening_results").select("check_name, priority, recommendation").eq("company_id", companyId).eq("status", "fail");

  // 7. Hardening score
  const { data: hardeningResults } = await supabase.from("wpshield_hardening_results").select("status, score_impact").eq("company_id", companyId);
  const score = (hardeningResults || []).reduce((sum, c) => (c.status === "pass" ? sum + (c.score_impact || 0) : sum), 0);

  const getMaturityLabel = (s: number) => {
    if (s <= 40) return "Critical Risk";
    if (s <= 60) return "Needs Attention";
    if (s <= 80) return "Moderate";
    if (s <= 90) return "Good";
    return "Excellent";
  };

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
    period: `Last ${periodDays} Days`,
    generatedAt: new Date().toISOString(),
    maturity: { score, label: getMaturityLabel(score) },
    stats: {
      totalAttacks: attackCount || 0,
      totalLogins: loginCount || 0,
      totalFileChanges: fileCount || 0,
      openAlerts: openAlertCount || 0,
    },
    vulnerablePlugins: vulnAlerts || [],
    topAttackingIps,
    recentFileChanges: fileChanges || [],
    failedChecks: failedChecks || [],
    analystReview: reviewData || null,
  };
}
