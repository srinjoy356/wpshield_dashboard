import { createClient } from "@/lib/supabase/server";
import { User } from "@supabase/supabase-js";
import { UserProfile } from "@/types";

export async function getUser(): Promise<{ user: User; profile: UserProfile } | null> {
  const supabase = createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) return null;

    return { user, profile };
  } catch (error) {
    console.error("Error in getUser:", error);
    return null;
  }
}
