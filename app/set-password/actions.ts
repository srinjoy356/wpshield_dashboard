"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function setPasswordAction(token: string, password: string) {
  const adminClient = createAdminClient();

  try {
    // 1. Validate token
    const { data: invite, error: inviteError } = await adminClient
      .from("client_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      return { error: "Invalid token." };
    }

    if (invite.used_at) {
      return { error: "This link has already been used." };
    }

    if (new Date(invite.expires_at) < new Date()) {
      return { error: "This link has expired." };
    }

    // 2. Get user UID from user_profiles via company_id
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("company_id", invite.company_id)
      .eq("role", "client")
      .maybeSingle();

    if (profileError || !profile) {
      return { error: "User account not found." };
    }

    // 3. Update password in Auth
    const { error: authError } = await adminClient.auth.admin.updateUserById(profile.id, {
      password: password
    });

    if (authError) {
      return { error: authError.message };
    }

    // 4. Mark token as used
    await adminClient
      .from("client_invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    // 5. Update client status to onboarded
    await adminClient
      .from("companies")
      .update({ status: "onboarded" })
      .eq("company_id", invite.company_id);

    return { success: true };

  } catch (err: any) {
    console.error("Set password action error:", err);
    return { error: "An unexpected error occurred." };
  }
}
