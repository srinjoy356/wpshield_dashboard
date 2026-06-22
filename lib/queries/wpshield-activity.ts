import { SupabaseClient } from "@supabase/supabase-js";
import { WPActivity } from "@/types";

export async function getWPActivityEvents(
  supabase: SupabaseClient,
  options?: { companyId?: string; limit?: number; since?: string }
) {
  let query = supabase
    .from("wpshield_events_activity")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (options?.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  // 'since' is used for plan-gated time windows (limited = 7 days, full = 90 days)
  if (options?.since) {
    query = query.gte("occurred_at", options.since);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as WPActivity[];
}