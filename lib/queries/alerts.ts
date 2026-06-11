import { SupabaseClient } from "@supabase/supabase-js";
import { Alert } from "@/types";

export async function getAlerts(
  supabase: SupabaseClient,
  options?: { companyId?: string; status?: string; limit?: number }
) {
  let query = supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.companyId) {
    query = query.eq("company_id", options.companyId);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Alert[];
}

export async function getAlertCounts(supabase: SupabaseClient, companyId?: string) {
  let query = supabase.from("alerts").select("status");
  
  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts = {
    open: 0,
    acknowledged: 0,
    resolved: 0,
  };

  data?.forEach((alert) => {
    const status = alert.status as keyof typeof counts;
    if (status in counts) {
      counts[status]++;
    }
  });

  return counts;
}

export async function getOpenAlertCount(supabase: SupabaseClient, companyId?: string) {
  let query = supabase.from("alerts").select("*", { count: "exact", head: true }).eq("status", "open");
  
  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function getCompanyAlertCount(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("alerts")
    .select("company_id")
    .eq("status", "open");
  
  if (error) throw error;
  
  const distinctCompanies = new Set(data?.map(a => a.company_id));
  return distinctCompanies.size;
}

export async function getCompanyAlertSummaries(supabase: SupabaseClient) {
  // First get all companies
  const { data: companies, error: cError } = await supabase
    .from("companies")
    .select("company_id, display_name, contact_email, site_url");
  
  if (cError) throw cError;

  // Then get alert counts and latest alert per company
  const { data: alerts, error: aError } = await supabase
    .from("alerts")
    .select("company_id, status, created_at");
  
  if (aError) throw aError;

  const summaries = companies.map(c => {
    const companyAlerts = alerts.filter(a => a.company_id === c.company_id);
    const openCount = companyAlerts.filter(a => a.status === "open").length;
    const lastAlert = companyAlerts.length > 0 
      ? companyAlerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at 
      : null;

    return {
      ...c,
      open_count: openCount,
      last_alert_at: lastAlert
    };
  });

  // Sort by open_count DESC, then last_alert_at DESC
  return summaries.sort((a, b) => {
    if (b.open_count !== a.open_count) return b.open_count - a.open_count;
    if (!a.last_alert_at) return 1;
    if (!b.last_alert_at) return -1;
    return new Date(b.last_alert_at).getTime() - new Date(a.last_alert_at).getTime();
  });
}

