import { SupabaseClient } from "@supabase/supabase-js";

export async function logActivity(
  supabaseAdmin: SupabaseClient,
  actorId: string,
  action: string,
  targetCompanyId: string | null,
  metadata: Record<string, unknown>
) {
  const { error } = await supabaseAdmin.from("activity_logs").insert({
    actor_id: actorId,
    action,
    target_company_id: targetCompanyId,
    metadata,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to log activity:", error);
    // We don't throw here to avoid failing the main action if logging fails, 
    // but in a production app you might want to handle this differently.
  }
}
