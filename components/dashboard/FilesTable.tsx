"use client";

import { useState, useMemo } from "react";
import { SeverityBadge } from "@/components/dashboard/SeverityBadge";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Search, Download } from "lucide-react";
import { FileEvent } from "@/types";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, exportToCSV } from "@/lib/utils";

interface FilesTableProps {
  initialEvents: FileEvent[];
}

export function FilesTable({ initialEvents }: FilesTableProps) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FileEvent | null>(null);
  
  // Time filtering state
  const [timeRange, setTimeRange] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const handleExport = () => {
    const headers = ["ID", "Time", "Event", "Path", "Size", "Severity", "Old Hash", "New Hash"];
    const rows = filtered.map(e => [
      e.id,
      e.occurred_at,
      e.event ?? "",
      e.path ?? "",
      e.size ? (e.size / 1024).toFixed(2) + " KB" : "",
      e.severity ?? "",
      e.old_hash ?? "",
      e.new_hash ?? ""
    ]);
    exportToCSV(headers, rows, `file_events_${Date.now()}.csv`);
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

      // Event type filter - Case insensitive and handles spaces/underscores/prefixes
      if (typeFilter !== "all") {
        const eventVal = (e.event ?? "").toLowerCase().replace(/ /g, "_").replace(/^file_/, "");
        if (eventVal !== typeFilter) return false;
      }
      
      // Search filter
      if (search) {
        if (!(e.path ?? "").toLowerCase().includes(search.toLowerCase())) return false;
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
          <option value="added">Added</option>
          <option value="modified">Modified</option>
          <option value="deleted">Deleted</option>
        </select>
        
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search by file path..."
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
              <th className="px-6 py-3 font-medium">Site</th>
              <th className="px-6 py-3 font-medium">Event</th>
              <th className="px-6 py-3 font-medium">Path</th>
              <th className="px-6 py-3 font-medium">Size</th>
              <th className="px-6 py-3 font-medium">Severity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <p className="text-sm text-[var(--muted)]">No file integrity events found matching your filters.</p>
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                return (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors"
                    onClick={() => setSelected(e)}
                  >
                    <td className="px-6 py-3 whitespace-nowrap">
                      <TimeCell dateStr={e.occurred_at} className="text-sm" />
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--muted)] max-w-[160px] truncate">
                      {e.site_url ?? <span className="italic">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {(e.event ?? "").replace(/^File_/, "").replace(/^File /, "").replace(/_/g, " ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs max-w-[300px] truncate" title={e.path ?? ""}>
                      {e.path ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--muted)]">
                      {e.size ? (e.size / 1024).toFixed(1) + " KB" : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <SeverityBadge severity={e.severity} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sheet remains same */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>File Change #{selected.id}</SheetTitle>
                <SheetDescription className="sr-only">Detailed file integrity event information</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="text-sm">
                  <p className="text-xs text-[var(--muted)] uppercase tracking-wider font-semibold mb-1">Path</p>
                  <p className="font-mono bg-[var(--surface-subtle)] p-3 rounded-lg break-all text-sm border border-[var(--border)]">
                    {selected.path ?? "—"}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider font-semibold mb-2">Old Hash</p>
                    <p className="font-mono text-xs bg-red-50/50 text-red-700 p-3 rounded-lg break-all border border-red-100">
                      {selected.old_hash || "None (New File)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider font-semibold mb-2">New Hash</p>
                    <p className="font-mono text-xs bg-green-50/50 text-green-700 p-3 rounded-lg break-all border border-green-100">
                      {selected.new_hash || "None (Deleted File)"}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider font-semibold mb-1">Size</p>
                    <p className="text-sm font-medium">
                      {selected.size ? (selected.size / 1024).toFixed(2) + " KB" : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--muted)] uppercase tracking-wider font-semibold mb-1">Time</p>
                    <TimeCell dateStr={selected.occurred_at} className="text-sm font-medium" />
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--muted)]">REMEDIATION ACTIONS</p>
                  <div className="flex gap-3">
                    <Button 
                      variant="destructive" 
                      onClick={async () => {
                        if (!confirm("Are you sure you want to delete this file? A backup will be created on the server first.")) return;
                        try {
                          const res = await fetch("/api/remediate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              company_id: selected.company_id,
                              action: "delete_file",
                              file_path: selected.path,
                              file_hash: selected.new_hash || selected.old_hash
                            })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Failed to delete file");
                          alert("Success: " + data.message);
                        } catch (err: any) {
                          alert("Error: " + err.message);
                        }
                      }}
                      className="w-full text-xs h-9"
                    >
                      Delete File
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={async () => {
                        if (!confirm("Quarantine this file? It will be renamed and disabled.")) return;
                        try {
                          const res = await fetch("/api/remediate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              company_id: selected.company_id,
                              action: "quarantine_file",
                              file_path: selected.path,
                              file_hash: selected.new_hash || selected.old_hash
                            })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Failed to quarantine file");
                          alert("Success: " + data.message);
                        } catch (err: any) {
                          alert("Error: " + err.message);
                        }
                      }}
                      className="w-full text-xs h-9 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                    >
                      Quarantine File
                    </Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="mb-2 text-xs font-medium text-[var(--muted)]">RAW JSON</p>
                  <pre className="max-h-[300px] overflow-auto rounded-lg bg-[var(--surface-subtle)] p-4 text-xs font-mono border border-[var(--border)]">
                    {JSON.stringify(selected, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}