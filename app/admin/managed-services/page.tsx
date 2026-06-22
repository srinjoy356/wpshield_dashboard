export const dynamic = 'force-dynamic';
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { redirect } from "next/navigation";
import { ManagedServicesClient } from "./ManagedServicesClient";

export default async function AdminManagedServicesPage() {
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);

  // requireAdmin checks role — redirect non-admins
  if (!profile || !['admin', 'super_admin'].includes(profile.role as string)) {
    redirect("/login");
  }

  const admin = createAdminClient();

  // Load all customer_addons. Supabase returns joined tables as arrays when
  // using the PostgREST select syntax — we cast to any[] and flatten in the client.
  const { data: addonsRaw } = await admin
    .from("customer_addons")
    .select(`
      id, status, current_period_start, current_period_end, created_at,
      customer:customers(id, email),
      site:sites(id, url),
      service:service_addons(id, code, name, scope_type, billing_interval, price_inr_live)
    `)
    .order("created_at", { ascending: false });

  // Normalise: Supabase returns one-to-one joins as single objects in JS even
  // though the TS types say array — flatten defensively so ManagedServicesClient
  // always receives plain objects, never arrays.
  const addons = (addonsRaw ?? []).map((a: any) => ({
    ...a,
    customer: Array.isArray(a.customer) ? a.customer[0] ?? null : a.customer,
    site:     Array.isArray(a.site)     ? a.site[0]     ?? null : a.site,
    service:  Array.isArray(a.service)  ? a.service[0]  ?? null : a.service,
  }));

  const { data: tasks } = await admin
    .from("managed_service_tasks")
    .select("id, customer_addon_id, service_month, assigned_analyst_id, priority, status, sla_due_at, completed_at, report_url")
    .order("service_month", { ascending: false });

  // Admin users for analyst assignment dropdown
  const { data: adminProfiles } = await admin
    .from("user_profiles")
    .select("id, display_name, role")
    .in("role", ["admin", "super_admin"]);

  return (
    <ManagedServicesClient
      addons={addons}
      tasks={tasks ?? []}
      analysts={adminProfiles ?? []}
    />
  );
}