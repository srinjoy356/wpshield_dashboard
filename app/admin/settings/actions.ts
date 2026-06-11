"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/queries/profile";
import { revalidatePath } from "next/cache";

export async function getGlobalSettingsAction() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden: Access denied." };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("wpshield_global_settings")
      .select("*")
      .eq("key", "smtp_config")
      .maybeSingle();

    if (error) throw error;
    return { success: true, settings: data?.value || null };
  } catch (err: any) {
    return { error: err.message || "Failed to load settings" };
  }
}

export async function saveGlobalSettingsAction(settings: {
  smtp_host: string;
  smtp_port: string;
  from_email: string;
}) {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden: Access denied." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("wpshield_global_settings")
      .upsert({
        key: "smtp_config",
        value: settings,
      });

    if (error) throw error;
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to save settings" };
  }
}
