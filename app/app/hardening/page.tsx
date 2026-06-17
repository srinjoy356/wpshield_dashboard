export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getCheckTargets } from "@/lib/queries/site-targets";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { HardeningContent, type SiteBundle } from "./components/HardeningContent";

export default async function HardeningPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const companyId = profile.company_id;

  // 1. Fetch company record — still needed for the legacy site_url fallback (a
  //    company that's never activated a site via a license yet) and as the source
  //    for getCheckTargets.
  const { data: company } = await supabase
    .from("companies")
    .select("site_url, uptime_response_ms, last_uptime_check, last_seen_at, uptime_status")
    .eq("company_id", companyId)
    .single();

  const targets = await getCheckTargets(supabase, { company_id: companyId, ...company });

  // 2. For each active site under this company, fetch its own scoped hardening
  //    results + evidence. A company with multiple sites previously only ever saw
  //    one shared, ambiguous set of results — this builds one independent bundle
  //    per site instead.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const sites: SiteBundle[] = await Promise.all(
    targets.map(async (target) => {
      const { site_id, url: siteUrl } = target;

      const scopeBy = <T,>(q: any) => (site_id ? q.eq("site_id", site_id) : q.is("site_id", null));

      const { data: initialResults } = await scopeBy(
        supabase.from("wpshield_hardening_results").select("*").eq("company_id", companyId)
      );

      const { data: criticalAlerts } = await scopeBy(
        supabase
          .from("alerts")
          .select("title, created_at")
          .eq("company_id", companyId)
          .eq("severity", "critical")
          .eq("status", "open")
          .order("created_at", { ascending: false })
      );

      const { data: highAlerts } = await scopeBy(
        supabase
          .from("alerts")
          .select("title, created_at")
          .eq("company_id", companyId)
          .eq("severity", "high")
          .eq("status", "open")
          .order("created_at", { ascending: false })
      );

      const { data: vulnAlerts } = await scopeBy(
        supabase
          .from("wpshield_vuln_alerts")
          .select("plugin_name, plugin_version, cve_id, severity, fixed_in, reference_url")
          .eq("company_id", companyId)
          .eq("status", "open")
          .order("created_at", { ascending: false })
      );

      const { data: fileAlerts } = await scopeBy(
        supabase
          .from("alerts")
          .select("title, created_at")
          .eq("company_id", companyId)
          .eq("source_table", "wpshield_events_file")
          .eq("status", "open")
          .gte("created_at", sevenDaysAgo.toISOString())
          .order("created_at", { ascending: false })
      );

      // Per-site uptime/heartbeat fields live on sites for a real activated site,
      // or fall back to the legacy companies fields when site_id is null.
      let uptimeResponseMs = company?.uptime_response_ms || 0;
      let lastUptimeCheck = company?.last_uptime_check || "";
      let lastSeenAt = company?.last_seen_at || "";

      if (site_id) {
        const { data: siteRow } = await supabase
          .from("sites")
          .select("uptime_response_ms, last_uptime_check, last_seen_at")
          .eq("id", site_id)
          .maybeSingle();
        uptimeResponseMs = siteRow?.uptime_response_ms || 0;
        lastUptimeCheck = siteRow?.last_uptime_check || "";
        lastSeenAt = siteRow?.last_seen_at || "";
      }

      return {
        site_id,
        site_url: siteUrl,
        initialResults: initialResults || [],
        evidence: {
          company: {
            site_url: siteUrl,
            uptime_response_ms: uptimeResponseMs,
            last_uptime_check: lastUptimeCheck,
            last_seen_at: lastSeenAt,
          },
          criticalAlerts: criticalAlerts || [],
          highAlerts: highAlerts || [],
          vulnAlerts: vulnAlerts || [],
          fileAlerts: fileAlerts || [],
        },
      };
    })
  );

  return <HardeningContent companyId={profile.company_id} sites={sites} />;
}