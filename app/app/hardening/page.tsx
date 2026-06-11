export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { HardeningContent } from "./components/HardeningContent";

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

  const { data: initialResults } = await supabase
    .from("wpshield_hardening_results")
    .select("*")
    .eq("company_id", profile.company_id);

  const companyId = profile.company_id;

  // 1. Fetch company record for site_url, uptime logs, heartbeat status
  const { data: company } = await supabase
    .from("companies")
    .select("site_url, uptime_response_ms, last_uptime_check, last_seen_at")
    .eq("company_id", companyId)
    .single();

  // 2. Fetch critical open alerts
  const { data: criticalAlerts } = await supabase
    .from("alerts")
    .select("title, created_at")
    .eq("company_id", companyId)
    .eq("severity", "critical")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  // 3. Fetch high open alerts
  const { data: highAlerts } = await supabase
    .from("alerts")
    .select("title, created_at")
    .eq("company_id", companyId)
    .eq("severity", "high")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  // 4. Fetch open vulnerable plugins
  const { data: vulnAlerts } = await supabase
    .from("wpshield_vuln_alerts")
    .select("plugin_name, plugin_version, cve_id, severity, fixed_in, reference_url")
    .eq("company_id", companyId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  // 5. Fetch file modification alerts in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: fileAlerts } = await supabase
    .from("alerts")
    .select("title, created_at")
    .eq("company_id", companyId)
    .eq("source_table", "wpshield_events_file")
    .eq("status", "open")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  const evidence = {
    company: {
      site_url: company?.site_url || "",
      uptime_response_ms: company?.uptime_response_ms || 0,
      last_uptime_check: company?.last_uptime_check || "",
      last_seen_at: company?.last_seen_at || "",
    },
    criticalAlerts: criticalAlerts || [],
    highAlerts: highAlerts || [],
    vulnAlerts: vulnAlerts || [],
    fileAlerts: fileAlerts || [],
  };

  return (
    <HardeningContent
      companyId={profile.company_id}
      initialResults={initialResults || []}
      evidence={evidence}
    />
  );
}
