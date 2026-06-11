import { SupabaseClient } from "@supabase/supabase-js";
import { Company, PendingCompany } from "@/types";

export async function getCompanies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) throw error;
  return data as Company[];
}

export async function getPendingCompanies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("pending_companies")
    .select("*")
    .order("last_seen_at", { ascending: false });

  if (error) throw error;
  return data as PendingCompany[];
}

export async function getCompanyById(supabase: SupabaseClient, companyId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return data as Company | null;
}

export async function getPendingCompanyById(supabase: SupabaseClient, companyId: string) {
  const { data, error } = await supabase
    .from("pending_companies")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (error) return null;
  return data as PendingCompany;
}

export async function updateCompany(
  supabaseAdmin: SupabaseClient,
  companyId: string,
  data: Partial<Company>
) {
  const { error } = await supabaseAdmin
    .from("companies")
    .update(data)
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function deleteCompany(supabaseAdmin: SupabaseClient, companyId: string) {
  const { error } = await supabaseAdmin
    .from("companies")
    .delete()
    .eq("company_id", companyId);

  if (error) throw error;
}

export async function getCompanyStats(supabase: SupabaseClient, companyId: string) {
  // Get counts from all 4 event tables
  const tables = [
    "wpshield_events_attack",
    "wpshield_events_login",
    "wpshield_events_file",
    "wpshield_inventory_snapshots",
  ];

  const counts = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);
      
      if (error) return 0;
      return count || 0;
    })
  );

  return {
    attacks: counts[0],
    logins: counts[1],
    files: counts[2],
    inventory: counts[3],
    total: counts.reduce((a, b) => a + b, 0),
  };
}

export async function getCompanyWithStats(supabase: SupabaseClient, companyId: string) {
  const company = await getCompanyById(supabase, companyId);
  if (!company) return null;

  const stats = await getCompanyStats(supabase, companyId);

  return {
    ...company,
    stats,
  };
}

export async function getCompaniesWithTodayStats(supabase: SupabaseClient) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) throw error;

  const tables = [
    "wpshield_events_attack",
    "wpshield_events_login",
    "wpshield_events_file",
    "wpshield_inventory_snapshots",
  ];

  const results = await Promise.all(
    companies.map(async (c) => {
      const counts = await Promise.all(
        tables.map(async (table) => {
          const { count } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true })
            .eq("company_id", c.company_id)
            .gte("occurred_at", today);
          return count || 0;
        })
      );
      return {
        ...c,
        todayEvents: counts.reduce((a, b) => a + b, 0),
      };
    })
  );

  return results.sort((a, b) => b.todayEvents - a.todayEvents);
}
