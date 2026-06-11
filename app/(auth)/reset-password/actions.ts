"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function resetPassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return { success: false, error: "Please fill out all fields." };
  }

  if (password !== confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }

  if (password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  try {
    const supabase = createClient();
    
    // Check if the user is actually authenticated (they should be via the callback route)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Your password reset session has expired or is invalid. Please request a new link." };
    }

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error("Password update error:", error);
      return { success: false, error: error.message };
    }

    // Force logout after password change for security
    await supabase.auth.signOut();
    (await cookies()).delete("wpshield_2fa_verified");

    return { success: true };
  } catch (err) {
    console.error("Unexpected password update error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
