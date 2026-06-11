"use client";

import { useState, useMemo } from "react";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { IPCell } from "@/components/dashboard/IPCell";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { EventDetailPanel } from "@/components/dashboard/EventDetailPanel";
import { Input } from "@/components/ui/input";
import { Search, Download } from "lucide-react";
import { AttackEvent } from "@/types";
import { truncate, exportToCSV } from "@/lib/utils";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";
import { Button } from "@/components/ui/button";

interface AttacksTableProps {
  initialEvents: AttackEvent[];
}

export function AttacksTable({ initialEvents }: AttacksTableProps) {
  const [patternFilter, setPatternFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AttackEvent | null>(null);
  
  // Time filtering state
  const [timeRange, setTimeRange] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const handleExport = () => {
    const headers = ["ID", "Time", "Pattern", "Severity", "IP", "Method", "URI", "User Agent"];
    const rows = filtered.map(e => [
      e.id,
      e.occurred_at,
      e.pattern_type ?? "",
      e.severity ?? "",
      e.ip ?? "",
      e.request_method ?? "",
      e.request_uri ?? "",
      e.user_agent ?? ""
    ]);
    exportToCSV(headers, rows, `attack_events_${Date.now()}.csv`);
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

      // Pattern filter
      if (patternFilter !== "all" && (e.pattern_type ?? "") !== patternFilter) return false;
      
      // Severity filter
      if (severityFilter !== "all" && (e.severity ?? "") !== severityFilter) return false;
      
      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const matches = 
          (e.request_uri ?? "").toLowerCase().includes(query) ||
          (e.ip ?? "").toLowerCase().includes(query) ||
          (e.user_agent ?? "").toLowerCase().includes(query) ||
          (e.pattern_type ?? "").toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [initialEvents, patternFilter, severityFilter, search, timeRange, customStart, customEnd]);

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
          value={patternFilter}
          onChange={(e) => setPatternFilter(e.target.value)}
          className="h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] text-[var(--foreground)]"
        >
          <option value="all">All Patterns</option>
          <option value="sqli">SQLi</option>
          <option value="xss">XSS</option>
          <option value="lfi">LFI</option>
          <option value="rce">RCE</option>
          <option value="scanner_ua">Scanner UA</option>
          <option value="sensitive_404">Sensitive 404</option>
          <option value="xmlrpc">XML-RPC</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)] text-[var(--foreground)]"
        >
          <option value="all">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search IP, URI, or user agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface border-[var(--border)] focus:ring-2 focus:ring-[var(--foreground)] h-10"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-6 py-3 font-medium">Time</th>
              <th className="px-6 py-3 font-medium">Pattern</th>
              <th className="px-6 py-3 font-medium">Severity</th>
              <th className="px-6 py-3 font-medium">IP</th>
              <th className="px-6 py-3 font-medium">Method</th>
              <th className="px-6 py-3 font-medium">URI</th>
              <th className="px-6 py-3 font-medium">User Agent</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <p className="text-sm text-[var(--muted)]">No attack events found matching your filters.</p>
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors"
                  onClick={() => setSelectedEvent(e)}
                >
                  <td className="px-6 py-3 whitespace-nowrap">
                    <TimeCell dateStr={e.occurred_at} className="text-sm" />
                  </td>
                  <td className="px-6 py-3">
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-[var(--info)] uppercase">
                      {e.pattern_type ?? "Unknown"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <SeverityBadge severity={e.severity} />
                  </td>
                  <td className="px-6 py-3">
                    <IPCell ip={e.ip ?? "0.0.0.0"} />
                  </td>
                  <td className="px-6 py-3 text-sm">{e.request_method ?? "—"}</td>
                  <td className="px-6 py-3 text-xs font-mono max-w-[200px]" title={e.request_uri ?? ""}>
                    {truncate(e.request_uri ?? "—", 50)}
                  </td>
                  <td className="px-6 py-3 text-xs max-w-[180px] truncate">{e.user_agent ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <EventDetailPanel
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
