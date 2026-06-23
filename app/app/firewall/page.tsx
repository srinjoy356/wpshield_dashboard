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

  // Base plan features for the logged-in user
  const userFeatures = await getPlanFeatures(supabase, user!.id);

  const company = profile.company_id
    ? await getCompanyById(supabase, profile.company_id)
    : null;

  const admin = createAdminClient();

  // Load sites with license info so we can check per-site premium status
  const { data: sitesRaw } = company
    ? await admin
        .from("sites")
        .select("id, url, maintenance_mode, away_mode_schedule, site_controls_enabled, license_id")
        .eq("company_id", company.company_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
    : { data: [] };

  const sites = sitesRaw ?? [];

  // Check which sites have an active premium license
  // A site is premium if its license_id links to an active subscription
  const premiumSiteIds = new Set<string>();
  const licenseIds = sites.map(s => s.license_id).filter(Boolean);

  if (licenseIds.length > 0) {
    const { data: licenses } = await admin
      .from("licenses")
      .select("id, subscription_id, status")
      .in("id", licenseIds)
      .eq("status", "active");

    if (licenses && licenses.length > 0) {
      const subIds = licenses.map(l => l.subscription_id).filter(Boolean);
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
          // Find which site has this license
          const site = sites.find(s => s.license_id === license.id);
          if (site) premiumSiteIds.add(site.id);
        }
      }
    }
  }

  const selectedSiteId = searchParams.site ?? null;

  // Determine effective features:
  // - If a specific site is selected: use that site's premium status
  // - If all-sites view (no site selected): use the user's plan features
  //   (company-level controls like IP/geo blocking apply to all sites
  //   so they follow the user's subscription)
  const selectedSite = selectedSiteId
    ? sites.find(s => s.id === selectedSiteId)
    : null;

  const selectedSiteIsPremium = selectedSite
    ? premiumSiteIds.has(selectedSite.id)
    : userFeatures.isActive; // all-sites view — use account-level

  // Strip license_id from sites before passing to client component (not needed there)
  const sitesForClient = sites.map(({ license_id, ...rest }) => rest);

  return (
    <FirewallPageContent
      profile={profile}
      company={company}
      sites={sitesForClient}
      selectedSiteId={selectedSiteId}
      features={{
        ipBlocking:      selectedSiteIsPremium && userFeatures.ipBlocking,
        geoBlocking:     selectedSiteIsPremium && userFeatures.geoBlocking,
        awayMode:        selectedSiteIsPremium && userFeatures.awayMode,
        maintenanceMode: userFeatures.maintenanceMode, // maintenance available on all plans
      }}
    />
  );
}