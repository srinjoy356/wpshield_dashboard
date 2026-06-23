import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies the logged-in user has access to the given company_id.
 * Admins can access any company.
 * Clients can only access their own company.
 *
 * Returns { allowed: true } or { allowed: false, response: Response }
 */
export async function verifyCompanyAccess(
  supabase: SupabaseClient,
  user_id: string,
  requested_company_id: string
): Promise<{ allowed: boolean; response?: Response }> {
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("company_id, role")
    .eq("id", user_id)
    .single();

  if (error || !profile) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  // Admins and Super Admins can write to any company
  if (profile.role === "admin" || profile.role === "super_admin") {
    return { allowed: true };
  }

  // Clients must match their own company_id
  if (profile.company_id !== requested_company_id) {
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ error: "Access Denied: Tenant boundary breach" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }

  return { allowed: true };
}