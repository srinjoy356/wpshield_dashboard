"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/queries/profile";
import { revalidatePath } from "next/cache";

export async function toggleAutoUpdatePlugins(companyId: string, enabled: boolean) {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);
  
  if (!profile || profile.company_id !== companyId) {
    throw new Error("Unauthorized");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ auto_update_plugins: enabled })
    .eq("company_id", companyId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/inventory");
}

export async function toggleAutoUpdateThemes(companyId: string, enabled: boolean) {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);
  
  if (!profile || profile.company_id !== companyId) {
    throw new Error("Unauthorized");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ auto_update_themes: enabled })
    .eq("company_id", companyId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/inventory");
}
