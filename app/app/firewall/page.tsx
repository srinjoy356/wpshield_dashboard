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
  searchParams: Promise<{ site?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  const userFeatures = await getPlanFeatures(supabase, user!.id);

  const company = profile.company_id
    ? await getCompanyById(supabase, profile.company_id)
    : null;

  const admin = createAdminClient();

  const { data: sitesRaw } = company
    ? await admin
        .from("sites")
        .select("id, url, maintenance_mode, away_mode_schedule, site_controls_enabled, license_id")
        .eq("company_id", company.company_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
    : { data: [] };

  const sites = sitesRaw ?? [];

  // Determine which sites are premium.
  // Strategy: a site is premium if it has a license_id that links to an
  // active, non-expired subscription — OR if the user's account subscription
  // is active AND the site belongs to their company (catches the case where
  // license_id on the site row is stale after a plan upgrade).
  //
  // The source of truth is: does this company have an active paid subscription?
  // If yes, ALL active sites under that company are premium.
  // The per-site license_id is used for the plugin's activation flow, not for
  // dashboard feature gating.

  const companyHasPremium = userFeatures.isActive;

  // Sites that have their own license explicitly linked (used as a secondary check)
  const siteWithLicenseIds = new Set<string>();
  if (!companyHasPremium) {
    // Only do the per-license check if the account-level check didn't pass
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
            if (site) siteWithLicenseIds.add(site.id);
          }
        }
      }
    }
  }

  // A site is premium if the company has an active subscription OR
  // the site has its own active license
  const premiumSiteIds: string[] = companyHasPremium
    ? sites.map(s => s.id)                           // all sites premium
    : sites.filter(s => siteWithLicenseIds.has(s.id)).map(s => s.id);

  const sitesForClient = sites.map(({ license_id, ...rest }) => rest);

  return (
    <FirewallPageContent
      profile={profile}
      company={company}
      sites={sitesForClient}
      selectedSiteId={resolvedSearchParams.site ?? null}
      userFeatures={{
        ipBlocking:      userFeatures.ipBlocking,
        geoBlocking:     userFeatures.geoBlocking,
        awayMode:        userFeatures.awayMode,
        maintenanceMode: userFeatures.maintenanceMode,
      }}
      premiumSiteIds={premiumSiteIds}
    />
  );
}