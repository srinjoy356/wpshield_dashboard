"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateClientProfileAction(formData: { displayName: string; email: string }) {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Update profile
  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ display_name: formData.displayName })
    .eq("id", user.id);

  if (profileError) return { error: profileError.message };

  // Get user's company_id
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (profile?.company_id) {
    // Update company contact email
    const { error: companyError } = await supabase
      .from("companies")
      .update({ contact_email: formData.email })
      .eq("company_id", profile.company_id);

    if (companyError) return { error: companyError.message };
  }

  revalidatePath("/app/settings");
  revalidatePath("/app", "layout"); // Update sidebar
  
  return { success: true };
}

export async function changeClientPasswordAction(formData: { currentPw: string; newPw: string }) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return { error: "Not authenticated" };

  // ── SEC-003: Server-side password complexity validation ──────────────────
  const { newPw } = formData;

  if (!newPw || newPw.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  // Must contain at least one uppercase letter
  if (!/[A-Z]/.test(newPw)) {
    return { error: "Password must contain at least one uppercase letter" };
  }

  // Must contain at least one lowercase letter
  if (!/[a-z]/.test(newPw)) {
    return { error: "Password must contain at least one lowercase letter" };
  }

  // Must contain at least one number
  if (!/[0-9]/.test(newPw)) {
    return { error: "Password must contain at least one number" };
  }

  // Must contain at least one special character
  if (!/[^A-Za-z0-9]/.test(newPw)) {
    return { error: "Password must contain at least one special character (!@#$%^&* etc.)" };
  }
  // ─────────────────────────────────────────────────────────────────────────

  // 1. Verify current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: formData.currentPw,
  });

  if (signInError) return { error: "Current password is incorrect" };

  // 2. Update to new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPw,
  });

  if (updateError) return { error: updateError.message };

  return { success: true };
}
