"use client";

import { useState, useMemo } from "react";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { IPCell } from "@/components/dashboard/IPCell";
import { Input } from "@/components/ui/input";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";
import { Search } from "lucide-react";
import { WPActivity } from "@/types";

// Human-readable labels for each action_type from the plugin
const ACTION_LABELS: Record<string, string> = {
  plugin_activated:   "Plugin Activated",
  plugin_deactivated: "Plugin Deactivated",
  plugin_deleted:     "Plugin Deleted",
  plugin_installed:   "Plugin Installed",
  theme_switched:     "Theme Switched",
  setting_changed:    "Setting Changed",
  post_published:     "Post Published",
  post_deleted:       "Post Deleted",
  user_deleted:       "User Deleted",
  profile_updated:    "Profile Updated",
  password_reset:     "Password Reset",
  core_updated:       "Core Updated",
};

function formatAction(action_type: string): string {
  return ACTION_LABELS[action_type] ?? action_type.replace(/_/g, " ");
}

// Action type groups for the filter dropdown
const ACTION_GROUPS = [
  { label: "All Actions",  value: "all" },
  { label: "Plugin",       value: "plugin" },
  { label: "Theme",        value: "theme" },
  { label: "Settings",     value: "setting" },
  { label: "Posts",        value: "post" },
  { label: "Users",        value: "user" },
  { label: "Password",     value: "password" },
  { label: "Core",         value: "core" },
];

interface Props {
  initialEvents: WPActivity[];
}

const PAGE_SIZE = 25;

export function ActivityTable({ initialEvents }: Props) {
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch]             = useState("");
  const [timeRange, setTimeRange]       = useState("7d");
  const [customStart, setCustomStart]   = useState("");
  const [customEnd, setCustomEnd]       = useState("");
  const [page, setPage]                 = useState(1);

  const filtered = useMemo(() => {
    const getStartDate = (range: string) => {
      const now = Date.now();
      if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000);
      if (range === "7d")  return new Date(now - 7  * 24 * 60 * 60 * 1000);
      if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
      return null;
    };

    const startDate = getStartDate(timeRange);

    return initialEvents.filter((e) => {
      // Time filter
      const eventDate = new Date(e.occurred_at);
      if (timeRange !== "custom") {
        if (startDate && eventDate < startDate) return false;
      } else {
        if (customStart && eventDate < new Date(customStart)) return false;
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (eventDate > end) return false;
        }
      }

      // Action group filter
      if (actionFilter !== "all" && !e.action_type.startsWith(actionFilter)) return false;

      // Search on user_login
      if (search) {
        const q = search.toLowerCase();
        const matches =
          (e.user_login ?? "").toLowerCase().includes(q) ||
          (e.action_type ?? "").toLowerCase().includes(q) ||
          (e.ip ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [initialEvents, actionFilter, search, timeRange, customStart, customEnd]);

  // Pagination
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  useMemo(() => { setPage(1); }, [actionFilter, search, timeRange]);

  return (
    <div className="space-y-4">

      {/* Time range + filters row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <TimeRangeTabs onChange={(r) => { setTimeRange(r); setPage(1); }} />
            {timeRange === "custom" && (
              <div className="hidden sm:flex items-center gap-2">
                <Input
                  type="date"
                  className="h-9 w-36 text-xs bg-surface border-[var(--border)]"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-[var(--muted)] text-xs">to</span>
                <Input
                  type="date"
                  className="h-9 w-36 text-xs bg-surface border-[var(--border)]"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
          </div>
          {timeRange === "custom" && (
            <div className="flex sm:hidden items-center gap-2">
              <Input type="date" className="h-9 flex-1 text-xs" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span className="text-xs text-[var(--muted)]">to</span>
              <Input type="date" className="h-9 flex-1 text-xs" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* Search + action filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] text-[var(--foreground)]"
        >
          {ACTION_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search user, action, or IP..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-surface border-[var(--border)] focus:ring-2 focus:ring-[var(--foreground)] h-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-6 py-3 font-medium">Date / Time</th>
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">Action</th>
              <th className="px-6 py-3 font-medium">Severity</th>
              <th className="px-6 py-3 font-medium">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-sm text-[var(--muted)]">No activity events match your filters.</p>
                </td>
              </tr>
            ) : (
              paginated.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] transition-colors"
                >
                  <td className="px-6 py-3 whitespace-nowrap">
                    <TimeCell dateStr={e.occurred_at} className="text-sm" />
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-[var(--foreground)]">
                    {e.user_login ?? <span className="text-[var(--muted)] italic">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-sm text-[var(--foreground)] capitalize">
                      {formatAction(e.action_type)}
                    </span>
                    {e.metadata && Object.keys(e.metadata).length > 0 && (
                      <p className="text-xs text-[var(--muted)] mt-0.5 font-mono truncate max-w-[220px]">
                        {Object.entries(e.metadata)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <SeverityBadge severity={e.severity ?? "low"} />
                  </td>
                  <td className="px-6 py-3">
                    <IPCell ip={e.ip ?? ""} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-[var(--muted)]">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}