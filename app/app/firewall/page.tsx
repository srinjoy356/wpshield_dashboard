export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getCompanyById } from "@/lib/queries/companies";
import { redirect } from "next/navigation";
import { FirewallPageContent } from "@/components/dashboard/FirewallPageContent";

export default async function ClientFirewallPage({
  searchParams,
}: {
  searchParams: { site?: string };
}) {
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);

  if (!profile) {
    redirect("/login");
  }

  const company = profile.company_id
    ? await getCompanyById(supabase, profile.company_id)
    : null;

  // Load all active sites for this company with per-site control columns.
  // These are needed to drive per-site maintenance/away mode and Force Sync.
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
    />
  );
}