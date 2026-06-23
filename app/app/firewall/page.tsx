export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getCompanyById } from "@/lib/queries/companies";
import { getPlanFeatures } from "@/lib/billing/get-plan-features";
import { redirect } from "next/navigation";
import { FirewallPageContent } from "@/components/dashboard/FirewallPageContent";
import { UpgradeLock } from "@/components/billing/UpgradeGate";

export default async function ClientFirewallPage({
  searchParams,
}: {
  searchParams: { site?: string };
}) {
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);

  if (!profile) redirect("/login");

  const { data: { user } } = await supabase.auth.getUser();
  const features = await getPlanFeatures(supabase, user!.id);

  // Core users get maintenance mode only — everything else is gated
  // The full firewall page (IP blocking, geo blocking, away mode) requires Solo+
  const company = profile.company_id
    ? await getCompanyById(supabase, profile.company_id)
    : null;

  const admin = createAdminClient();
  const { data: sites } = company
    ? await admin
        .from("sites")
        .select("id, url, maintenance_mode, away_mode_schedule, site_controls_enabled")
        .eq("company_id", company.company_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
    : { data: [] };

  const selectedSiteId = searchParams.site ?? null;

  return (
    <FirewallPageContent
      profile={profile}
      company={company}
      sites={sites ?? []}
      selectedSiteId={selectedSiteId}
      features={{
        ipBlocking:     features.ipBlocking,
        geoBlocking:    features.geoBlocking,
        awayMode:       features.awayMode,
        maintenanceMode: features.maintenanceMode,
      }}
    />
  );
}