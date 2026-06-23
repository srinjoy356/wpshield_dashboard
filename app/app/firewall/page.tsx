export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getCompanyById } from "@/lib/queries/companies";
import { getPlanFeatures } from "@/lib/billing/get-plan-features";
import { redirect } from "next/navigation";
import { FirewallPageContent } from "@/components/dashboard/FirewallPageContent";

export default async function ClientFirewallPage({
  searchParams,
}: {
  searchParams: { site?: string };
}) {
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  const userFeatures = await getPlanFeatures(supabase, user!.id);

  const company = profile.company_id
    ? await getCompanyById(supabase, profile.company_id)
    : null;

  const admin = createAdminClient();

  // Load sites WITH license_id so FirewallPageContent can determine
  // per-site premium status client-side (since site selection is client state)
  const { data: sitesRaw } = company
    ? await admin
        .from("sites")
        .select("id, url, maintenance_mode, away_mode_schedule, site_controls_enabled, license_id")
        .eq("company_id", company.company_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
    : { data: [] };

  const sites = sitesRaw ?? [];

  // Build premiumSiteIds on the server where we can query licenses/subscriptions
  // Pass it to the client so FirewallPageContent can gate per selected site
  const premiumSiteIds: string[] = [];
  const licenseIds = sites.map(s => s.license_id).filter(Boolean) as string[];

  if (licenseIds.length > 0) {
    const { data: licenses } = await admin
      .from("licenses")
      .select("id, subscription_id, status")
      .in("id", licenseIds)
      .eq("status", "active");

    if (licenses && licenses.length > 0) {
      const subIds = licenses.map(l => l.subscription_id).filter(Boolean) as string[];
      const { data: subs } = await admin
        .from("subscriptions")
        .select("id, status, current_period_end")
        .in("id", subIds)
        .eq("status", "active");

      const activeSubs = new Set(
        (subs ?? [])
          .filter(s => new Date(s.current_period_end) > new Date())
          .map(s => s.id)
      );

      for (const license of licenses) {
        if (activeSubs.has(license.subscription_id)) {
          const site = sites.find(s => s.license_id === license.id);
          if (site) premiumSiteIds.push(site.id);
        }
      }
    }
  }

  // Strip license_id before sending to client component
  const sitesForClient = sites.map(({ license_id, ...rest }) => rest);

  return (
    <FirewallPageContent
      profile={profile}
      company={company}
      sites={sitesForClient}
      selectedSiteId={searchParams.site ?? null}
      // User-level feature flags (what their plan allows)
      userFeatures={{
        ipBlocking:      userFeatures.ipBlocking,
        geoBlocking:     userFeatures.geoBlocking,
        awayMode:        userFeatures.awayMode,
        maintenanceMode: userFeatures.maintenanceMode,
      }}
      // Which site IDs have an active paid license
      premiumSiteIds={premiumSiteIds}
    />
  );
}