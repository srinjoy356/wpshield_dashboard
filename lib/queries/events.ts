import { SupabaseClient } from "@supabase/supabase-js";
import { AttackEvent, LoginEvent, FileEvent } from "@/types";

export async function getAttackEvents(
  supabase: SupabaseClient,
  options?: { companyId?: string; limit?: number }
) {
  let query = supabase
    .from("wpshield_events_attack")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (options?.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as AttackEvent[];
}

export async function getLoginEvents(
  supabase: SupabaseClient,
  options?: { companyId?: string; limit?: number }
) {
  let query = supabase
    .from("wpshield_events_login")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (options?.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as LoginEvent[];
}

export async function getFileEvents(
  supabase: SupabaseClient,
  options?: { companyId?: string; limit?: number }
) {
  let query = supabase
    .from("wpshield_events_file")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (options?.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as FileEvent[];
}

export async function getLatestInventoryByKind(
  supabase: SupabaseClient,
  companyId: string
) {
  const { data: snapshots, error } = await supabase
    .from("wpshield_inventory_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  if (!snapshots || snapshots.length === 0) return null;

  // Group by kind (latest first)
  const coreRow = snapshots.find(s => s.kind === 'core');
  const pluginsRow = snapshots.find(s => s.kind === 'plugins');
  const themesRow = snapshots.find(s => s.kind === 'themes');

  const parsePayload = (row: any) => {
    if (!row) return null;
    return typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  };

  const coreData = parsePayload(coreRow);
  const pluginsData = parsePayload(pluginsRow);
  const themesData = parsePayload(themesRow);

  return {
    core: coreData,
    plugins: pluginsData?.plugins ?? [],
    themes: themesData?.themes ?? [],
    pluginCount: pluginsData?.count ?? 0,
    themeCount: themesData?.count ?? 0,
    lastUpdated: pluginsRow?.occurred_at ?? coreRow?.occurred_at ?? snapshots[0]?.occurred_at ?? null
  };
}
