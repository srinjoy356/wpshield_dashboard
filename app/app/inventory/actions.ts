"use server";

import { createClient } from "@/lib/supabase/server";

export async function toggleAutoUpdatePlugins(companyId: string, enabled: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("companies")
    .update({ auto_update_plugins: enabled })
    .eq("company_id", companyId);

  if (error) {
    throw new Error(error.message);
  }
}
