"use client";

import { useState, useMemo, useEffect } from "react";
import { Alert, Severity } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { BellOff, CheckCircle, ClipboardCheck, Search, FilterX, X } from "lucide-react";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AlertsListProps {
  initialAlerts: Alert[];
  isAdmin?: boolean;
  showCompanyFilter?: boolean;
}

const severityOrder: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function AlertsList({ initialAlerts, isAdmin, showCompanyFilter }: AlertsListProps) {
  const [activeTab, setActiveTab] = useState("open");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filter states
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");

  // Get unique companies for admin filter
  const companies = useMemo(() => {
    const set = new Set<string>();
    initialAlerts.forEach(a => {
      if (a.company_id) set.add(a.company_id);
    });
    return Array.from(set).sort();
  }, [initialAlerts]);

  // Get unique sites for the site filter — only meaningful (and only shown) once
  // there's more than one distinct site to actually choose between.
  const sites = useMemo(() => {
    const set = new Set<string>();
    initialAlerts.forEach(a => {
      if (a.site_url) set.add(a.site_url);
    });
    return Array.from(set).sort();
  }, [initialAlerts]);

  // Keyboard navigation for collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtering logic
  const filteredAlerts = useMemo(() => {
    return initialAlerts.filter(alert => {
      // Status filter (Tab)
      if (alert.status !== activeTab) return false;

      // Search filter
      if (search) {
        const query = search.toLowerCase();
        const matchesSearch =
          alert.title.toLowerCase().includes(query) ||
          alert.description.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Source filter
      if (sourceFilter !== "all" && alert.source_table !== sourceFilter) return false;

      // Severity filter
      if (severityFilter !== "all" && alert.severity !== severityFilter) return false;

      // Company filter (Admin only)
      if ((isAdmin || showCompanyFilter) && companyFilter !== "all" && alert.company_id !== companyFilter) return false;

      // Site filter
      if (siteFilter !== "all" && alert.site_url !== siteFilter) return false;

      return true;
    });
  }, [initialAlerts, activeTab, search, sourceFilter, severityFilter, companyFilter, siteFilter, isAdmin]);

  // Sort logic
  const sortedAlerts = useMemo(() => {
    return [...filteredAlerts].sort((a, b) => {
      if (activeTab === "open") {
        // Sort by severity first
        const sevA = severityOrder[a.severity as Severity] || 0;
        const sevB = severityOrder[b.severity as Severity] || 0;
        if (sevA !== sevB) return sevB - sevA;
      }
      // Then by date
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredAlerts, activeTab]);

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("all");
    setSeverityFilter("all");
    setCompanyFilter("all");
    setSiteFilter("all");
  };

  const hasActiveFilters = search !== "" || sourceFilter !== "all" || severityFilter !== "all" || companyFilter !== "all" || siteFilter !== "all";

  // Tab counts
  const counts = {
    open: initialAlerts.filter(a => a.status === "open").length,
    acknowledged: initialAlerts.filter(a => a.status === "acknowledged").length,
    resolved: initialAlerts.filter(a => a.status === "resolved").length,
  };

  return (
    <div className="space-y-6">
      {/* Tabs redesign */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-11 items-center justify-start rounded-full bg-[var(--surface-subtle)] p-1 border border-[var(--border)]">
          <TabsTrigger
            value="open"
            className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-[var(--border)]"
          >
            Open
            <span className={cn(
              "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
              activeTab === "open" ? "bg-red-500 text-white" : counts.open > 0 ? "bg-red-500/20 text-red-600" : "bg-muted text-muted-foreground"
            )}>
              {counts.open}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="acknowledged"
            className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-[var(--border)]"
          >
            Acknowledged
            <span className={cn(
              "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
              activeTab === "acknowledged" ? "bg-amber-500 text-white" : counts.acknowledged > 0 ? "bg-amber-500/20 text-amber-600" : "bg-muted text-muted-foreground"
            )}>
              {counts.acknowledged}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="resolved"
            className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-[var(--foreground)] data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-[var(--border)]"
          >
            Resolved
            <span className={cn(
              "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
              activeTab === "resolved" ? "bg-green-600 text-white" : counts.resolved > 0 ? "bg-green-600/20 text-green-600" : "bg-muted text-muted-foreground"
            )}>
              {counts.resolved}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Filter Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              placeholder="Search alerts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-10 rounded-lg border-[var(--border)] focus-visible:ring-1 focus-visible:ring-[var(--foreground)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px] h-10 rounded-lg border-[var(--border)]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="wpshield_events_file">File integrity</SelectItem>
              <SelectItem value="wpshield_events_attack">Attack detection</SelectItem>
              <SelectItem value="wpshield_events_login">Login activity</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px] h-10 rounded-lg border-[var(--border)]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {sites.length > 1 && (
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-[180px] h-10 rounded-lg border-[var(--border)]">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(isAdmin || showCompanyFilter) && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[160px] h-10 rounded-lg border-[var(--border)]">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-10 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <FilterX className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3">
          {sortedAlerts.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-[var(--border)] rounded-2xl">
              {hasActiveFilters ? (
                <EmptyState
                  icon={Search}
                  title="No matching alerts"
                  description="Try adjusting your filters or search query to find what you're looking for."
                />
              ) : (
                <EmptyState
                  icon={activeTab === "open" ? BellOff : activeTab === "acknowledged" ? ClipboardCheck : CheckCircle}
                  title={activeTab === "open" ? "No open alerts" : activeTab === "acknowledged" ? "No acknowledged alerts" : "No resolved alerts"}
                  description={activeTab === "open" ? "Your site is currently secure. We'll alert you if anything changes." : "You're all caught up."}
                />
              )}
            </div>
          ) : (
            sortedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isAdmin={isAdmin}
                isExpanded={expandedId === alert.id}
                onToggle={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
              />
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
}