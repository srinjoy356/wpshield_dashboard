"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/queries/profile";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Common check for admin permissions
 */
async function verifyAdmin() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: Only admins can perform this action.");
  }
  return profile;
}

export async function updateClientAction(
  companyId: string, 
  data: { 
    display_name: string; 
    contact_email: string; 
    notes?: string; 
    status: string;
  }
) {
  try {
    const adminProfile = await verifyAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("companies")
      .update({
        display_name: data.display_name,
        contact_email: data.contact_email,
        notes: data.notes,
        status: data.status,
      })
      .eq("company_id", companyId);

    if (error) throw error;

    await logActivity(
      adminClient,
      adminProfile.id,
      "client.updated",
      companyId,
      { changed_fields: data }
    );

    revalidatePath(`/admin/clients/${companyId}`);
    revalidatePath("/admin/clients");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function resetClientPasswordAction(companyId: string, newPassword: string) {
  try {
    const adminProfile = await verifyAdmin();
    const adminClient = createAdminClient();

    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("role", "client")
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("Client user profile not found.");
    }

    const { error: authError } = await adminClient.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (authError) throw authError;

    await logActivity(
      adminClient,
      adminProfile.id,
      "client.password_reset",
      companyId,
      { method: "admin_manual" }
    );

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function suspendClientAction(companyId: string) {
  try {
    const adminProfile = await verifyAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("companies")
      .update({ status: "suspended" })
      .eq("company_id", companyId);

    if (error) throw error;

    await logActivity(
      adminClient,
      adminProfile.id,
      "client.suspended",
      companyId,
      {}
    );

    revalidatePath(`/admin/clients/${companyId}`);
    revalidatePath("/admin/clients");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function unsuspendClientAction(companyId: string) {
  try {
    const adminProfile = await verifyAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("companies")
      .update({ status: "active" })
      .eq("company_id", companyId);

    if (error) throw error;

    await logActivity(
      adminClient,
      adminProfile.id,
      "client.unsuspended",
      companyId,
      {}
    );

    revalidatePath(`/admin/clients/${companyId}`);
    revalidatePath("/admin/clients");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteClientAction(companyId: string) {
  try {
    const adminProfile = await verifyAdmin();
    const adminClient = createAdminClient();

    // 1. Log activity BEFORE deleting
    // We log it without target_company_id to ensure it's not deleted by the next step, 
    // but we put the companyId in metadata.
    await logActivity(
      adminClient,
      adminProfile.id,
      "client.deleted",
      null, 
      { company_id: companyId }
    );

    // 2. DELETE FROM alerts WHERE company_id=?
    await adminClient.from("alerts").delete().eq("company_id", companyId);
    
    // 3. DELETE FROM activity_logs WHERE target_company_id=?
    await adminClient.from("activity_logs").delete().eq("target_company_id", companyId);

    // 4. DELETE FROM pending_companies WHERE company_id=?
    await adminClient.from("pending_companies").delete().eq("company_id", companyId);

    // 5. SELECT id FROM user_profiles WHERE company_id=?
    const { data: profiles } = await adminClient
      .from("user_profiles")
      .select("id")
      .eq("company_id", companyId);

    // 6. DELETE FROM user_profiles WHERE company_id=?
    await adminClient.from("user_profiles").delete().eq("company_id", companyId);

    // 7. DELETE FROM companies WHERE company_id=?
    await adminClient.from("companies").delete().eq("company_id", companyId);

    // 8. supabase.auth.admin.deleteUser(userId)
    if (profiles) {
      for (const p of profiles) {
        await adminClient.auth.admin.deleteUser(p.id);
      }
    }

    revalidatePath("/admin/clients");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
