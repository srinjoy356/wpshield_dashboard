"use server";

import { createClient } from "@/lib/supabase/server";

export async function getCompaniesList() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("company_id, display_name")
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Failed to fetch companies:", error);
    return [];
  }
  return data || [];
}
