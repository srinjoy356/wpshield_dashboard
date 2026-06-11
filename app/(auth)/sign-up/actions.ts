"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity";

export async function signUpAction(formData: FormData) {
  const adminClient = createAdminClient();
  
  const email = formData.get("contact_email") as string;
  const company_id = formData.get("company_id") as string;
  const display_name = formData.get("display_name") as string;
  const site_url = formData.get("site_url") as string;
  
  // Math CAPTCHA validation
  const num1 = parseInt(formData.get("captcha_num1") as string, 10);
  const num2 = parseInt(formData.get("captcha_num2") as string, 10);
  const answer = parseInt(formData.get("captcha_answer") as string, 10);

  if (isNaN(num1) || isNaN(num2) || isNaN(answer) || num1 + num2 !== answer) {
    return { error: "CAPTCHA validation failed. Please solve the math problem correctly." };
  }

  if (!email || !company_id || !display_name || !site_url) {
    return { error: "Missing required fields." };
  }

  // Basic regex to ensure company_id is alphanumeric/dashes
  if (!/^[a-zA-Z0-9-]+$/.test(company_id)) {
    return { error: "Company ID can only contain letters, numbers, and dashes." };
  }

  // Generate a random secure password for the background creation
  const password = Math.random().toString(36).slice(-12) + "A1!"; 

  try {
    // Check if company_id already exists
    const { data: existingCompany } = await adminClient
      .from("companies")
      .select("id")
      .eq("company_id", company_id)
      .maybeSingle();

    if (existingCompany) {
      return { error: "A client with this Company ID already exists." };
    }

    // Create auth user
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
      // Insert into companies
      const { error: companyError } = await adminClient
        .from("companies")
        .insert({
          company_id,
          display_name,
          contact_email: email,
          site_url: site_url,
          status: "active",
        });

      if (companyError) throw companyError;

      try {
        // Insert into user_profiles
        const { error: profileError } = await adminClient
          .from("user_profiles")
          .insert({
            id: newUser.id,
            company_id,
            role: "client",
            display_name,
          });

        if (profileError) throw profileError;

        // Log activity
        await logActivity(
          adminClient,
          newUser.id,
          "client.onboarded",
          company_id,
          {
            display_name,
            contact_email: email,
            source: "public_signup",
          }
        );

        return { 
          success: true, 
          credentials: { 
            email, 
            company_id, 
            display_name 
          } 
        };

      } catch (err: any) {
        await adminClient.from("companies").delete().eq("company_id", company_id);
        throw err;
      }
    } catch (err: any) {
      await adminClient.auth.admin.deleteUser(newUser.id);
      return { error: err.message || "Failed to create client account." };
    }

  } catch (err: any) {
    return { error: "An unexpected error occurred." };
  }
}
