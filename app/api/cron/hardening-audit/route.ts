import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function getMaturity(score: number): string {
  if (score <= 40) return "Critical Risk";
  if (score <= 60) return "Needs Attention";
  if (score <= 80) return "Moderate";
  if (score <= 90) return "Good";
  return "Excellent";
}

export async function GET(request: Request) {
  console.log('[Audit] Started:', Date.now());
  try {
    // 1. Secure route with x-cron-secret header check
    const secretHeader = request.headers.get("x-cron-secret");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET is not set" },
        { status: 500 }
      );
    }

    if (!secretHeader || secretHeader !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Fetch all active companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, company_id, display_name, site_url, status, uptime_status, uptime_response_ms, last_uptime_check, last_seen_at")
      .eq("status", "active");

    console.log('[Audit] Companies fetched:', Date.now());

    if (companiesError) {
      console.error("Error fetching active companies:", companiesError);
      return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    const results = [];

    // 3. Perform hardening checks for each active company
    for (const company of companies) {
      const companyId = company.company_id;
      const siteUrl = company.site_url;
      const uptimeStatus = company.uptime_status || "unknown";
      const lastSeenAt = company.last_seen_at;

      // ── CHECK 1: https_enforced ──
      console.log('[Audit] Checking https_enforced for', companyId, Date.now());
      const check1Passed = !!(siteUrl && siteUrl.startsWith("https://"));
      const check1 = {
        key: "https_enforced",
        name: "HTTPS Enforced",
        category: "Network",
        passed: check1Passed,
        priority: "high",
        failDescription: "Your site is not using HTTPS. All traffic is unencrypted.",
        recommendation: "Install an SSL certificate and force HTTPS on your site.",
        scoreImpact: 15,
      };
      console.log('[Audit] Done https_enforced:', Date.now());

      // ── CHECK 2: no_critical_open_alerts ──
      console.log('[Audit] Checking no_critical_open_alerts for', companyId, Date.now());
      const { count: criticalCount, error: criticalErr } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("severity", "critical")
        .eq("status", "open");

      if (criticalErr) console.error("Err fetching critical alerts:", criticalErr.message);
      const check2Passed = !criticalErr && (criticalCount || 0) === 0;
      const check2 = {
        key: "no_critical_open_alerts",
        name: "No Critical Open Alerts",
        category: "Alerts",
        passed: check2Passed,
        priority: "high",
        failDescription: "You have unresolved critical security alerts on your site.",
        recommendation: "Review and resolve all critical alerts immediately.",
        scoreImpact: 20,
      };
      console.log('[Audit] Done no_critical_open_alerts:', Date.now());

      // ── CHECK 3: no_vulnerable_plugins ──
      console.log('[Audit] Checking no_vulnerable_plugins for', companyId, Date.now());
      const { count: vulnCount, error: vulnErr } = await supabase
        .from("wpshield_vuln_alerts")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "open");

      if (vulnErr) console.error("Err fetching vuln alerts:", vulnErr.message);
      const check3Passed = !vulnErr && (vulnCount || 0) === 0;
      const check3 = {
        key: "no_vulnerable_plugins",
        name: "No Vulnerable Plugins",
        category: "Plugins",
        passed: check3Passed,
        priority: "high",
        failDescription: "One or more plugins have known security vulnerabilities.",
        recommendation: "Update all flagged plugins to their fixed versions immediately.",
        scoreImpact: 20,
      };
      console.log('[Audit] Done no_vulnerable_plugins:', Date.now());

      // ── CHECK 4: uptime_healthy ──
      console.log('[Audit] Checking uptime_healthy for', companyId, Date.now());
      const check4Passed = uptimeStatus === "up";
      const check4 = {
        key: "uptime_healthy",
        name: "Uptime Healthy",
        category: "Availability",
        passed: check4Passed,
        priority: "high",
        failDescription: "Your site is currently offline or unreachable.",
        recommendation: "Check your hosting provider and restore your site immediately.",
        scoreImpact: 15,
      };
      console.log('[Audit] Done uptime_healthy:', Date.now());

      // ── CHECK 5: plugin_heartbeat_recent ──
      console.log('[Audit] Checking plugin_heartbeat_recent for', companyId, Date.now());
      const check5Passed = !!(
        lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= 24 * 60 * 60 * 1000
      );
      const check5 = {
        key: "plugin_heartbeat_recent",
        name: "Plugin Heartbeat Recent",
        category: "Monitoring",
        passed: check5Passed,
        priority: "medium",
        failDescription: "WPShield plugin has not sent data in over 24 hours.",
        recommendation: "Check if the WPShield plugin is active and properly configured.",
        scoreImpact: 10,
      };
      console.log('[Audit] Done plugin_heartbeat_recent:', Date.now());

      // ── CHECK 6: no_high_open_alerts ──
      console.log('[Audit] Checking no_high_open_alerts for', companyId, Date.now());
      const { count: highCount, error: highErr } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("severity", "high")
        .eq("status", "open");

      if (highErr) console.error("Err fetching high alerts:", highErr.message);
      const check6Passed = !highErr && (highCount || 0) < 10;
      const check6 = {
        key: "no_high_open_alerts",
        name: "No High Open Alerts",
        category: "Alerts",
        passed: check6Passed,
        priority: "medium",
        failDescription: "You have many unresolved high severity alerts.",
        recommendation: "Review and acknowledge or resolve high severity alerts.",
        scoreImpact: 10,
      };
      console.log('[Audit] Done no_high_open_alerts:', Date.now());

      // ── CHECK 7: no_file_modification_alerts ──
      console.log('[Audit] Checking no_file_modification_alerts for', companyId, Date.now());
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: fileCount, error: fileErr } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("source_table", "wpshield_events_file")
        .eq("status", "open")
        .gte("created_at", sevenDaysAgo.toISOString());

      if (fileErr) console.error("Err fetching file alerts:", fileErr.message);
      const check7Passed = !fileErr && (fileCount || 0) === 0;
      const check7 = {
        key: "no_file_modification_alerts",
        name: "No Recent File Modification Alerts",
        category: "Files",
        passed: check7Passed,
        priority: "medium",
        failDescription: "Unexpected file modifications detected on your site recently.",
        recommendation: "Review all file change alerts and verify they were authorized.",
        scoreImpact: 10,
      };
      console.log('[Audit] Done no_file_modification_alerts:', Date.now());

      const checks = [check1, check2, check3, check4, check5, check6, check7];

      // Calculate score
      const score = checks.reduce((sum, c) => (c.passed ? sum + c.scoreImpact : sum), 0);

      // Upsert checks
      const checksToUpsert = checks.map((c) => ({
        company_id: companyId,
        check_key: c.key,
        check_name: c.name,
        category: c.category,
        status: c.passed ? "pass" : "fail",
        priority: c.priority,
        description: c.passed ? "Check passed successfully." : c.failDescription,
        recommendation: c.passed ? "No action required." : c.recommendation,
        score_impact: c.scoreImpact,
        last_checked_at: new Date().toISOString(),
      }));

      console.log('[Audit] Upserting results:', Date.now());
      const { error: upsertError } = await supabase
        .from("wpshield_hardening_results")
        .upsert(checksToUpsert, { onConflict: "company_id,check_key" });

      if (upsertError) {
        console.error(`Failed to upsert hardening results for ${companyId}:`, upsertError.message);
      }
      console.log('[Audit] Upsert done:', Date.now());

      results.push({
        company_id: companyId,
        display_name: company.display_name || companyId,
        score,
        maturity: getMaturity(score),
        checks: checks.map((c) => ({
          key: c.key,
          name: c.name,
          category: c.category,
          passed: c.passed,
          score_impact: c.scoreImpact,
        })),
      });
    }

    console.log('[Audit] Completed:', Date.now());
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Hardening audit cron failed:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
