import { SupabaseClient } from "@supabase/supabase-js";
import { ActivityLog } from "@/types";

export async function getActivityLogs(
  supabase: SupabaseClient,
  options?: { 
    limit?: number; 
    action?: string;
    days?: number;
    search?: string;
  }
) {
  let query = supabase
    .from("activity_logs")
    .select(`
      *,
      actor:user_profiles(display_name, role),
      target_company:companies(display_name)
    `)
    .order("created_at", { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.action && options.action !== "all") {
    query = query.eq("action", options.action);
  }

  if (options?.days) {
    const date = new Date();
    date.setDate(date.getDate() - options.days);
    query = query.gte("created_at", date.toISOString());
  }

  if (options?.search) {
    // Note: complex searching on joined fields is tricky in Supabase without RPC or views, 
    // but we can at least search the action column.
    query = query.ilike("action", `%${options.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return (data || []).map(log => ({
    id: log.id,
    actor_id: log.actor_id,
    actor_name: log.actor?.display_name || "System",
    actor_role: log.actor?.role || "admin",
    action: log.action,
    target_company_id: log.target_company_id,
    target_company_name: log.target_company?.display_name,
    metadata: log.metadata,
    created_at: log.created_at,
  })) as ActivityLog[];
}
