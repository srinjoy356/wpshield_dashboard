import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/security/guards";

// PATCH — update an existing task (status, analyst, SLA, report_url)
export async function PATCH(request: Request) {
  const supabase = createClient();
  const guard    = await requireAdmin(supabase);
  if (!guard.allowed) return guard.response;

  const body = await request.json();
  const { task_id, ...changes } = body;

  if (!task_id) {
    return NextResponse.json({ error: "task_id is required" }, { status: 400 });
  }

  // Only allow safe updatable fields
  const allowed = ["status", "assigned_analyst_id", "sla_due_at", "priority", "notes", "report_url", "completed_at"];
  const update  = Object.fromEntries(Object.entries(changes).filter(([k]) => allowed.includes(k)));

  if (update.status === "completed" && !update.completed_at) {
    update.completed_at = new Date().toISOString();
  }

  update.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("managed_service_tasks")
    .update(update)
    .eq("id", task_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// POST — create a new task for the next service month
export async function POST(request: Request) {
  const supabase = createClient();
  const guard    = await requireAdmin(supabase);
  if (!guard.allowed) return guard.response;

  const { customer_addon_id } = await request.json();
  if (!customer_addon_id) {
    return NextResponse.json({ error: "customer_addon_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find the latest task to determine the next service month
  const { data: latest } = await admin
    .from("managed_service_tasks")
    .select("service_month")
    .eq("customer_addon_id", customer_addon_id)
    .order("service_month", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextMonth: Date;
  if (latest?.service_month) {
    const last = new Date(latest.service_month);
    nextMonth  = new Date(last.getFullYear(), last.getMonth() + 1, 1);
  } else {
    const now = new Date();
    nextMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const serviceMonth = nextMonth.toISOString().slice(0, 10);

  // SLA = response_time_hours from the service addon
  const { data: addon } = await admin
    .from("customer_addons")
    .select("service:service_addons(response_time_hours)")
    .eq("id", customer_addon_id)
    .single();

  const responseHours = (addon?.service as any)?.response_time_hours ?? 48;
  const slaDueAt = new Date(Date.now() + responseHours * 60 * 60 * 1000).toISOString();

  const { data: task, error } = await admin
    .from("managed_service_tasks")
    .insert({
      customer_addon_id,
      service_month: serviceMonth,
      priority:      "normal",
      status:        "pending",
      sla_due_at:    slaDueAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task });
}