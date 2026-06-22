"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, AlertTriangle, User, FileText, ChevronDown } from "lucide-react";

interface Analyst { id: string; display_name: string; role: string; }
interface Task {
  id: string;
  customer_addon_id: string;
  service_month: string;
  assigned_analyst_id: string | null;
  priority: string;
  status: string;
  sla_due_at: string | null;
  completed_at: string | null;
  report_url: string | null;
}
interface Addon {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  created_at: string;
  customer: { id: string; email: string } | null;
  site: { id: string; url: string } | null;
  service: { id: string; code: string; name: string; scope_type: string; billing_interval: string; price_inr_live: number } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed:   "bg-emerald-100 text-emerald-700",
  blocked:     "bg-red-100 text-red-700",
  escalated:   "bg-orange-100 text-orange-700",
  cancelled:   "bg-gray-100 text-gray-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "text-gray-500",
  normal: "text-blue-600",
  high:   "text-orange-600",
  urgent: "text-red-600 font-bold",
};

export function ManagedServicesClient({ addons, tasks, analysts }: {
  addons: Addon[];
  tasks: Task[];
  analysts: Analyst[];
}) {
  const { toast } = useToast();
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [expandedAddon, setExpandedAddon] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Get tasks for a given addon
  function addonTasks(addonId: string) {
    return localTasks.filter((t) => t.customer_addon_id === addonId);
  }

  async function updateTask(taskId: string, changes: Partial<Task>) {
    setSaving(taskId);
    try {
      const res = await fetch("/api/admin/managed-services/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, ...changes }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setLocalTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...changes } : t));
      toast({ title: "Task updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  async function createNextTask(addonId: string) {
    setSaving(addonId);
    try {
      const res = await fetch("/api/admin/managed-services/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_addon_id: addonId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const { task } = await res.json();
      setLocalTasks((prev) => [task, ...prev]);
      toast({ title: "Task created for next service month" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Managed Services"
        subtitle="Assign analysts, track tasks, and manage fulfillment for all managed service customers."
      />

      {addons.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
          <p className="text-[var(--muted)]">No managed service purchases yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {addons.map((addon) => {
            const myTasks    = addonTasks(addon.id);
            const isExpanded = expandedAddon === addon.id;
            const latestTask = myTasks[0] ?? null;

            return (
              <div key={addon.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {/* Addon header row */}
                <button
                  onClick={() => setExpandedAddon(isExpanded ? null : addon.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--surface-subtle)] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--foreground)] truncate">
                        {addon.customer?.email ?? "—"}
                      </p>
                      <p className="text-xs text-[var(--muted)] truncate">
                        {addon.service?.name ?? "—"} · {addon.site?.url ?? "Account-wide"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      addon.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {addon.status}
                    </span>
                    {latestTask && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[latestTask.status] ?? ""}`}>
                        Task: {latestTask.status.replace("_", " ")}
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Expanded task management */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">Tasks</h4>
                      <button
                        onClick={() => createNextTask(addon.id)}
                        disabled={saving === addon.id}
                        className="rounded px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:opacity-50 transition-colors"
                      >
                        {saving === addon.id ? "Creating…" : "+ New task"}
                      </button>
                    </div>

                    {myTasks.length === 0 ? (
                      <p className="text-xs text-[var(--muted)]">No tasks yet. Create one to start tracking this service period.</p>
                    ) : (
                      <div className="space-y-3">
                        {myTasks.map((task) => (
                          <div key={task.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={1.5} />
                                <span className="text-xs font-mono text-[var(--muted)]">
                                  {new Date(task.service_month).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                                </span>
                                <span className={`text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}>
                                  {task.priority.toUpperCase()}
                                </span>
                              </div>

                              {/* Status selector */}
                              <select
                                value={task.status}
                                disabled={saving === task.id}
                                onChange={(e) => updateTask(task.id, { status: e.target.value })}
                                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] focus:outline-none"
                              >
                                {["pending","in_progress","completed","blocked","escalated","cancelled"].map((s) => (
                                  <option key={s} value={s}>{s.replace("_"," ")}</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Analyst assignment */}
                              <div>
                                <label className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1 block">Analyst</label>
                                <select
                                  value={task.assigned_analyst_id ?? ""}
                                  disabled={saving === task.id}
                                  onChange={(e) => updateTask(task.id, { assigned_analyst_id: e.target.value || null })}
                                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
                                >
                                  <option value="">Unassigned</option>
                                  {analysts.map((a) => (
                                    <option key={a.id} value={a.id}>{a.display_name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* SLA due */}
                              <div>
                                <label className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1 block">SLA Due</label>
                                <input
                                  type="date"
                                  value={task.sla_due_at ? task.sla_due_at.slice(0,10) : ""}
                                  disabled={saving === task.id}
                                  onChange={(e) => updateTask(task.id, { sla_due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
                                />
                              </div>

                              {/* Report URL */}
                              <div>
                                <label className="text-[10px] text-[var(--muted)] uppercase tracking-wide mb-1 block">Report URL</label>
                                <input
                                  type="url"
                                  placeholder="https://..."
                                  value={task.report_url ?? ""}
                                  disabled={saving === task.id}
                                  onChange={(e) => updateTask(task.id, { report_url: e.target.value || null })}
                                  onBlur={(e) => {
                                    if (e.target.value !== (task.report_url ?? "")) {
                                      updateTask(task.id, { report_url: e.target.value || null });
                                    }
                                  }}
                                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)] focus:outline-none"
                                />
                              </div>
                            </div>

                            {task.sla_due_at && new Date(task.sla_due_at) < new Date() && task.status !== "completed" && (
                              <div className="flex items-center gap-2 text-xs text-red-600">
                                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
                                SLA overdue — due {new Date(task.sla_due_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
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