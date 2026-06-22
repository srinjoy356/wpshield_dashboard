export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/queries/profile";
import { CheckCircle, Clock, FileText, AlertTriangle } from "lucide-react";

export default async function ClientServicesPage() {
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);
  if (!profile) redirect("/login");

  // Find customer record
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!customer) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">My Services</h1>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <p className="text-[var(--muted)]">No managed services found on your account.</p>
          <p className="text-xs text-[var(--muted)] mt-2">
            Contact your administrator to add a managed service to your subscription.
          </p>
        </div>
      </div>
    );
  }

  // Load all customer addons with service and task info
  const { data: addons } = await admin
    .from("customer_addons")
    .select(`
      id, status, current_period_start, current_period_end,
      site:sites(id, url),
      service:service_addons(id, name, description, included_deliverables, review_frequency),
      tasks:managed_service_tasks(id, service_month, status, sla_due_at, completed_at, report_url)
    `)
    .eq("customer_id", customer.id)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">My Services</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Managed security services provided by the Cybernara team.
        </p>
      </div>

      {!addons || addons.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <p className="text-[var(--muted)]">No managed services on your account yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {addons.map((addon) => {
            const service  = Array.isArray(addon.service) ? addon.service[0] : addon.service;
            const site     = Array.isArray(addon.site)    ? addon.site[0]    : addon.site;
            const allTasks = (Array.isArray(addon.tasks)  ? addon.tasks : []) as any[];
            const latestTask = allTasks.sort((a: any, b: any) =>
              new Date(b.service_month).getTime() - new Date(a.service_month).getTime()
            )[0];
            const completedTasks = allTasks.filter((t: any) => t.status === "completed");

            return (
              <div key={addon.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--foreground)]">
                        {service?.name ?? "Managed Service"}
                      </h2>
                      <p className="text-sm text-[var(--muted)] mt-0.5">
                        {site ? `Covering: ${site.url}` : "Account-wide coverage"}
                      </p>
                      {service?.description && (
                        <p className="text-xs text-[var(--muted)] mt-2 max-w-xl">{service.description}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      addon.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {addon.status}
                    </span>
                  </div>

                  {/* Deliverables */}
                  {service?.included_deliverables && service.included_deliverables.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {service.included_deliverables.map((d: string) => (
                        <span key={d} className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs text-[var(--muted)]">
                          {d.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current period */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1">Period</p>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {new Date(addon.current_period_start).toLocaleDateString()}
                      {addon.current_period_end && ` – ${new Date(addon.current_period_end).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1">Next Review</p>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {latestTask?.status === "completed"
                        ? "Next month"
                        : latestTask?.sla_due_at
                        ? new Date(latestTask.sla_due_at).toLocaleDateString()
                        : "To be scheduled"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1">Current Status</p>
                    <p className={`text-sm font-medium ${
                      latestTask?.status === "completed" ? "text-emerald-600" :
                      latestTask?.status === "in_progress" ? "text-blue-600" :
                      latestTask?.status === "escalated" ? "text-orange-600" :
                      "text-[var(--foreground)]"
                    }`}>
                      {latestTask?.status?.replace("_", " ") ?? "Pending"}
                    </p>
                  </div>
                </div>

                {/* Report history */}
                {completedTasks.length > 0 && (
                  <div className="border-t border-[var(--border)] p-6">
                    <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Report History</h3>
                    <div className="space-y-2">
                      {completedTasks.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.5} />
                            <span className="text-sm text-[var(--foreground)]">
                              {new Date(t.service_month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                            </span>
                          </div>
                          {t.report_url ? (
                            <a
                              href={t.report_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--brand)] hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                              View Report
                            </a>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">Report pending upload</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}