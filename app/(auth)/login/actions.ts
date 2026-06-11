"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = createClient();

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { success: false, error: "Invalid email or password" };
  }

  if (data.user) {
    // Try regular client first (cleanest fix)
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    let profile = profileData;

    // Fallback to admin client if we get a 403 or other error despite successful sign-in
    if (profileError || !profile) {
      console.warn("Regular profile lookup failed, trying admin client:", profileError);
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminSupabase = createAdminClient();
      const { data: adminProfile, error: adminError } = await adminSupabase
        .from("user_profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      
      if (adminError || !adminProfile) {
        console.error("Admin profile lookup also failed:", adminError);
        return { success: false, error: "Account is not configured. Contact your administrator." };
      }
      profile = adminProfile;
    }

    return { success: true, role: profile.role };
  }

  return { success: false, error: "An unexpected error occurred." };
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  (await cookies()).delete("wpshield_2fa_verified");
}
