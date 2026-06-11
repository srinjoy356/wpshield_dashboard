"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/queries/profile";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";

export async function onboardClientAction(formData: FormData, isFromPending: boolean = false) {
  const supabase = createClient();
  const adminClient = createAdminClient();
  
  // 1. Verify admin
  const profile = await getCurrentProfile(supabase);
  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden: Only admins can onboard clients." };
  }

  const email = formData.get("contact_email") as string;
  const password = (formData.get("password") as string) || Math.random().toString(36).slice(-12);
  
  console.log("====================================");
  console.log("GENERATED PASSWORD FOR:", email);
  console.log(password);
  console.log("====================================");
  
  const company_id = formData.get("company_id") as string;
  const display_name = formData.get("display_name") as string;
  const site_url = formData.get("site_url") as string;
  const notes = formData.get("notes") as string;

  if (!email || !company_id || !display_name) {
    return { error: "Missing required fields." };
  }

  try {
    // 3. Check if company_id exists
    const { data: existingCompany } = await adminClient
      .from("companies")
      .select("id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (existingCompany) {
      return { error: "A client with this Company ID already exists." };
    }

    // 4. Create auth user (this will fail if email exists)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name }
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return { error: "An account with this email already exists." };
      }
      return { error: authError.message };
    }
    const newUser = authData.user;

    try {
      // 5. Insert into companies
      const { error: companyError } = await adminClient
        .from("companies")
        .insert({
          company_id,
          display_name,
          contact_email: email,
          site_url: site_url || null,
          status: "active",
          notes: notes || null,
        });

      if (companyError) throw companyError;

      try {
        // 6. Insert into user_profiles
        const { error: profileError } = await adminClient
          .from("user_profiles")
          .insert({
            id: newUser.id,
            company_id,
            role: "client",
            display_name,
          });

        if (profileError) throw profileError;

        // 8. If from pending, remove pending row
        if (isFromPending) {
          await adminClient
            .from("pending_companies")
            .delete()
            .eq("company_id", company_id);
        }

        // 9. Log activity
        await logActivity(
          adminClient,
          profile.id,
          "client.onboarded",
          company_id,
          {
            display_name,
            contact_email: email,
            source: isFromPending ? "pending" : "manual",
          }
        );

        revalidatePath("/admin/clients");
        return { 
          success: true, 
          credentials: { 
            email, 
            password, 
            company_id, 
            display_name 
          } 
        };

      } catch (err: any) {
        // Rollback companies
        await adminClient.from("companies").delete().eq("company_id", company_id);
        throw err;
      }
    } catch (err: any) {
      // Rollback auth user
      await adminClient.auth.admin.deleteUser(newUser.id);
      return { error: err.message || "Failed to create client account." };
    }

  } catch (err: any) {
    return { error: "An unexpected error occurred." };
  }
}
