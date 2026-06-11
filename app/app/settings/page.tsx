import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getCompanyById } from "@/lib/queries/companies";
import { redirect } from "next/navigation";
import { SettingsPageContent } from "@/components/dashboard/SettingsPageContent";

export default async function ClientSettingsPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) {
    redirect("/login");
  }

  const company = profile.company_id ? await getCompanyById(supabase, profile.company_id) : null;

  return <SettingsPageContent profile={profile} company={company} />;
}
