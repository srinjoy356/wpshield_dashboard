"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function acknowledgeAlertAction(alertId: number) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
      .from("alerts")
      .update({
        status: "acknowledged",
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) throw error;

    revalidatePath("/admin/alerts");
    revalidatePath("/app/alerts");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function resolveAlertAction(alertId: number) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
      .from("alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) throw error;

    revalidatePath("/admin/alerts");
    revalidatePath("/app/alerts");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function bulkAcknowledgeAlertsAction(companyId?: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error("Unauthorized");

    let query = supabase
      .from("alerts")
      .update({
        status: "acknowledged",
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("status", "open");

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { error } = await query;

    if (error) throw error;

    revalidatePath("/admin/alerts");
    revalidatePath("/app/alerts");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
