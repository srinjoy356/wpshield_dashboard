"use client";

import { useState, useMemo } from "react";
import { IPCell } from "@/components/dashboard/IPCell";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { Check, X, LogOut, Shield, UserPlus, Search, Download } from "lucide-react";
import { LoginEvent } from "@/types";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoginDetailPanel } from "@/components/dashboard/LoginDetailPanel";
import { cn, exportToCSV } from "@/lib/utils";

const eventIcons: Record<string, React.ReactNode> = {
  login_success: <Check className="h-4 w-4 text-[var(--success)]" strokeWidth={2} />,
  login_failed: <X className="h-4 w-4 text-white" strokeWidth={3} />,
  logout: <LogOut className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />,
  role_changed: <Shield className="h-4 w-4 text-[var(--warning)]" strokeWidth={1.5} />,
  user_created: <UserPlus className="h-4 w-4 text-[var(--info)]" strokeWidth={1.5} />,
};

interface LoginsTableProps {
  initialEvents: LoginEvent[];
}

export function LoginsTable({ initialEvents }: LoginsTableProps) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<LoginEvent | null>(null);
  
  // Time filtering state
  const [timeRange, setTimeRange] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const handleExport = () => {
    const headers = ["ID", "Time", "Event", "Username", "IP", "Roles"];
    const rows = filtered.map(e => [
      e.id,
      e.occurred_at,
      e.event ?? "",
      e.login ?? "",
      e.ip ?? "",
      Array.isArray(e.roles_json) ? e.roles_json.join("; ") : (e.roles_json ? String(e.roles_json) : "")
    ]);
    exportToCSV(headers, rows, `login_events_${Date.now()}.csv`);
  };

  const filtered = useMemo(() => {
    const getStartDate = (range: string) => {
      const now = Date.now();
      if (range === '24h') return new Date(now - 24 * 60 * 60 * 1000);
      if (range === '7d')  return new Date(now - 7 * 24 * 60 * 60 * 1000);
      if (range === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000);
      return null;
    };

    const startDate = getStartDate(timeRange);

    return initialEvents.filter((e) => {
      // Time filter
      const eventDate = new Date(e.occurred_at);
      if (timeRange !== 'custom') {
        if (startDate && eventDate < startDate) return false;
      } else {
        if (customStart && eventDate < new Date(customStart)) return false;
        if (customEnd) {
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          if (eventDate > end) return false;
        }
      }

      // Event type filter - Normalize for robustness
      if (typeFilter !== "all") {
        const eventVal = (e.event ?? "").toLowerCase().replace(/ /g, "_");
        if (eventVal !== typeFilter) return false;
      }
      
      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const matches = 
          (e.login ?? "").toLowerCase().includes(query) ||
          (e.ip ?? "").toLowerCase().includes(query) ||
          (e.roles_json ?? "").toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [initialEvents, typeFilter, search, timeRange, customStart, customEnd]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <TimeRangeTabs onChange={setTimeRange} />
            {timeRange === 'custom' && (
              <div className="hidden sm:flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                <Input 
                  type="date" 
                  className="h-9 w-36 text-xs bg-surface border-[var(--border)] focus:ring-1 focus:ring-[var(--foreground)]" 
                  value={customStart} 
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-[var(--muted)] text-xs">to</span>
                <Input 
                  type="date" 
                  className="h-9 w-36 text-xs bg-surface border-[var(--border)] focus:ring-1 focus:ring-[var(--foreground)]" 
                  value={customEnd} 
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            )}
          </div>
          {/* Mobile custom date inputs */}
          {timeRange === 'custom' && (
            <div className="flex sm:hidden items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Input 
                type="date" 
                className="h-9 flex-1 text-xs bg-surface" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="text-[var(--muted)] text-xs">to</span>
              <Input 
                type="date" 
                className="h-9 flex-1 text-xs bg-surface" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}
        </div>
        <Button onClick={handleExport} variant="outline" size="sm" className="h-9 gap-2 text-xs font-medium border-[var(--border)] bg-surface hover:bg-[var(--surface-subtle)]">
          <Download className="h-4 w-4" strokeWidth={1.5} />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] text-[var(--foreground)]"
        >
          <option value="all">All Events</option>
          <option value="login_success">Login Success</option>
          <option value="login_failed">Login Failed</option>
          <option value="logout">Logout</option>
          <option value="role_changed">Role Changed</option>
          <option value="user_created">User Created</option>
        </select>
        
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search by user, IP or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface border-[var(--border)] focus:ring-2 focus:ring-[var(--foreground)] h-10"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-6 py-3 font-medium">Time</th>
              <th className="px-6 py-3 font-medium">Event</th>
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">IP</th>
              <th className="px-6 py-3 font-medium">Roles</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-sm text-[var(--muted)]">No login events found matching your filters.</p>
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const normEvent = (e.event ?? "").toLowerCase().replace(/ /g, "_");
                const isFailed = normEvent === "login_failed";
                const isLogout = normEvent === "logout";
                
                return (
                  <tr
                    key={e.id}
                    className={cn(
                      "border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] transition-all cursor-pointer",
                      isFailed ? "bg-red-50/50 border-l-2 border-l-red-500" : "",
                      isLogout ? "bg-gray-50/50" : ""
                    )}
                    onClick={() => setSelectedEvent(e)}
                  >
                    <td className="px-6 py-3 whitespace-nowrap">
                      <TimeCell dateStr={e.occurred_at} className="text-sm" />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full",
                          isFailed ? "bg-red-500" : "bg-[var(--surface-subtle)]"
                        )}>
                          {eventIcons[normEvent] || eventIcons[e.event ?? ""]}
                        </div>
                        <span className={cn(
                          "text-sm font-medium capitalize",
                          isFailed ? "text-red-700" : ""
                        )}>
                          {(e.event ?? "").replace(/_/g, " ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium">{e.login?.trim() || "—"}</td>
                    <td className="px-6 py-3">
                      <IPCell ip={e.ip ?? ""} />
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--muted)]">
                      {(() => {
                        if (!e.roles_json) return "—";
                        try {
                          const roles = typeof e.roles_json === 'string' ? JSON.parse(e.roles_json) : e.roles_json;
                          if (Array.isArray(roles)) return roles.join(", ");
                          return String(roles);
                        } catch {
                          return String(e.roles_json);
                        }
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <LoginDetailPanel 
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
