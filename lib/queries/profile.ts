import { SupabaseClient } from "@supabase/supabase-js";
import { UserProfile } from "@/types";

export async function getCurrentProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    // If regular lookup fails (RLS), try with service role if available in a safe way
    // or just return null and let middleware handle it.
    // For now, assume RLS is fixed or this is called from server component.
    return null;
  }

  return data as UserProfile;
}
