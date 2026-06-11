export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getCompanyById } from "@/lib/queries/companies";
import { redirect } from "next/navigation";
import { FirewallPageContent } from "@/components/dashboard/FirewallPageContent";

export default async function ClientFirewallPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    redirect("/login");
  }

  const company = profile.company_id ? await getCompanyById(supabase, profile.company_id) : null;

  return <FirewallPageContent profile={profile} company={company} />;
}
