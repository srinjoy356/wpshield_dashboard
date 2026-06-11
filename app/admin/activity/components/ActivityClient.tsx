"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Activity, UserPlus, UserX, UserCheck, ShieldAlert, ShieldCheck, KeyRound, Settings, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { ActivityLog } from "@/types";
import { Badge } from "@/components/ui/badge";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";

interface ActivityClientProps {
  initialLogs: ActivityLog[];
}

const actionIcons: Record<string, React.ReactNode> = {
  "client.onboarded": <UserPlus className="h-4 w-4 text-[var(--success)]" strokeWidth={1.5} />,
  "client.suspended": <UserX className="h-4 w-4 text-amber-600" strokeWidth={1.5} />,
  "client.unsuspended": <UserCheck className="h-4 w-4 text-green-600" strokeWidth={1.5} />,
  "client.deleted": <UserX className="h-4 w-4 text-[var(--critical)]" strokeWidth={1.5} />,
  "client.updated": <Settings className="h-4 w-4 text-blue-600" strokeWidth={1.5} />,
  "client.password_reset": <KeyRound className="h-4 w-4 text-yellow-600" strokeWidth={1.5} />,
};

const actionLabels: Record<string, string> = {
  "client.onboarded": "onboarded new client",
  "client.suspended": "suspended client",
  "client.unsuspended": "reactivated client",
  "client.deleted": "deleted client",
  "client.updated": "updated client details",
  "client.password_reset": "reset client password",
};

const actionColors: Record<string, string> = {
  "client.onboarded": "bg-green-500",
  "client.suspended": "bg-amber-500",
  "client.unsuspended": "bg-green-500",
  "client.deleted": "bg-red-500",
  "client.updated": "bg-blue-500",
  "client.password_reset": "bg-yellow-500",
};

export function ActivityClient({ initialLogs }: ActivityClientProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedLogs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedLogs(next);
  };

  const getStartDate = (range: string) => {
    switch(range) {
      case '24h':  return new Date(Date.now() - 24 * 60 * 60 * 1000);
      case '7d':   return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      case '30d':  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      case 'all':  return null;
      default:     return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }
  };

  const filteredLogs = initialLogs.filter(log => {
    // 1. Time range filter
    const startDate = getStartDate(timeRange);
    if (startDate && new Date(log.created_at) < startDate) return false;

    // 2. Search filter
    if (search) {
      const matchesSearch = 
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        (log.target_company_name?.toLowerCase().includes(search.toLowerCase())) ||
        (log.actor_name?.toLowerCase().includes(search.toLowerCase()));
      if (!matchesSearch) return false;
    }
    
    // 3. Action type filter
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title="Activity Logs" />

      <TimeRangeTabs 
        onChange={setTimeRange} 
        defaultRange="7d"
        ranges={[
          { label: "24h", value: "24h" },
          { label: "7d", value: "7d" },
          { label: "30d", value: "30d" },
          { label: "All time", value: "all" },
        ]}
      />

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-surface p-4 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input 
            placeholder="Search logs by action or client..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All Actions</option>
            <option value="client.onboarded">Onboarding</option>
            <option value="client.updated">Updates</option>
            <option value="client.suspended">Suspension</option>
            <option value="client.password_reset">Password Reset</option>
            <option value="client.deleted">Deletion</option>
          </select>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <EmptyState 
          icon={Activity}
          title="No matching logs"
          description={timeRange !== 'all' ? "No activity in the selected time period." : "Try adjusting your filters or search terms."}
        />
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--border)]" />
          
          <div className="space-y-6">
            {filteredLogs.map((log) => (
              <div key={log.id} className="relative flex gap-4 pl-12">
                {/* Timeline dot */}
                <div className={`absolute left-[14px] top-2 h-3 w-3 rounded-full border-2 border-surface ${actionColors[log.action] || "bg-gray-400"}`} />
                
                <div className="flex-1 rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-hidden hover:border-[var(--muted)] transition-colors">
                  <div 
                    className="p-4 cursor-pointer flex items-start justify-between gap-4"
                    onClick={() => toggleExpand(String(log.id))}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 border border-[var(--border)]">
                        <AvatarFallback className="bg-[var(--surface-subtle)] text-xs font-bold">
                          {log.actor_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{log.actor_name}</span>
                          <Badge variant="secondary" className="text-[10px] py-0 h-4 uppercase tracking-wider">
                            {log.actor_role}
                          </Badge>
                          <span className="text-sm text-[var(--muted)]">
                            {actionLabels[log.action] || log.action}
                          </span>
                          {log.target_company_id && (
                            <Badge variant="outline" className="font-mono text-[10px] py-0 h-4 border-dashed">
                              {log.target_company_name || log.target_company_id}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                          <Clock className="h-3 w-3" />
                          <TimeCell dateStr={log.created_at} className="inline" />
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      {expandedLogs.has(String(log.id)) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {expandedLogs.has(String(log.id)) && (
                    <div className="bg-[var(--surface-subtle)]/50 border-t border-[var(--border)] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2">Metadata</p>
                      <pre className="text-xs font-mono bg-surface p-3 rounded-lg border border-[var(--border)] overflow-auto max-h-40">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
