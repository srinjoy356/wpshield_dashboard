"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ExternalLink,
  ShieldAlert,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export interface VulnAlert {
  id: number;
  company_id: string;
  plugin_slug: string;
  plugin_name: string;
  plugin_version: string;
  vuln_title: string;
  vuln_id: string;
  severity: string;
  cvss_score: number | null;
  cve_id: string | null;
  source: string;
  fixed_in: string | null;
  reference_url: string;
  status: string;
  created_at: string;
}

interface VulnerabilitiesListProps {
  vulnerabilities: VulnAlert[];
}

const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function highestSeverity(vulns: VulnAlert[]): string {
  let best = "low";
  for (const v of vulns) {
    const key = v.severity?.toLowerCase() ?? "low";
    if ((SEVERITY_RANK[key] ?? 0) > (SEVERITY_RANK[best] ?? 0)) best = key;
  }
  return best;
}

function getSeverityStyles(severity: string) {
  switch (severity.toLowerCase()) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-green-50 text-green-700 border-green-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export function VulnerabilitiesList({ vulnerabilities }: VulnerabilitiesListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Group all CVEs by plugin_slug
  const groupedPlugins = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; version: string; vulns: VulnAlert[] }>();
    for (const v of vulnerabilities) {
      const slug = v.plugin_slug ?? "unknown";
      if (!map.has(slug)) {
        map.set(slug, { slug, name: v.plugin_name ?? slug, version: v.plugin_version ?? "—", vulns: [] });
      }
      map.get(slug)!.vulns.push(v);
    }
    return Array.from(map.values());
  }, [vulnerabilities]);

  // Filter by plugin name only (search box)
  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return groupedPlugins;
    const q = searchQuery.toLowerCase();
    return groupedPlugins.filter((p) => p.name.toLowerCase().includes(q));
  }, [groupedPlugins, searchQuery]);

  const toggle = (slug: string) => {
    setExpandedSlug((prev) => (prev === slug ? null : slug));
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">Vulnerabilities</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Known security vulnerabilities identified in active plugins.
          </p>
        </div>

        {vulnerabilities.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-[var(--success)] shadow-sm">
            <CheckCircle className="h-3.5 w-3.5" />
            No vulnerabilities detected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 shadow-sm animate-pulse">
            <ShieldAlert className="h-3.5 w-3.5" />
            {groupedPlugins.length} vulnerable {groupedPlugins.length === 1 ? "plugin" : "plugins"} found
          </span>
        )}
      </div>

      {vulnerabilities.length > 0 && (
        <div className="space-y-4">
          {/* Search box */}
          <div className="relative max-w-sm">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
              strokeWidth={1.5}
            />
            <Input
              placeholder="Search by plugin name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-surface"
            />
          </div>

          {/* Accordion list */}
          {filteredPlugins.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-surface px-6 py-8 text-center text-sm text-[var(--muted)] shadow-sm">
              No plugins match your search.
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-hidden divide-y divide-[var(--border)]">
              {filteredPlugins.map((plugin) => {
                const topSeverity = highestSeverity(plugin.vulns);
                const isOpen = expandedSlug === plugin.slug;

                return (
                  <div key={plugin.slug}>
                    {/* Plugin row — clickable header */}
                    <button
                      onClick={() => toggle(plugin.slug)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--surface-subtle)] transition-colors"
                    >
                      {/* Plugin name + version */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                          {plugin.name}
                        </p>
                        <p className="text-xs font-mono text-[var(--muted)] mt-0.5">
                          v{plugin.version}
                        </p>
                      </div>

                      {/* CVE count badge */}
                      <span className="shrink-0 inline-flex items-center rounded-full bg-[var(--surface-subtle)] border border-[var(--border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted-foreground)]">
                        {plugin.vulns.length} {plugin.vulns.length === 1 ? "CVE" : "CVEs"}
                      </span>

                      {/* Severity badge */}
                      <span
                        className={`shrink-0 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${getSeverityStyles(topSeverity)}`}
                      >
                        {topSeverity}
                      </span>

                      {/* Chevron */}
                      <span className="shrink-0 text-[var(--muted)]">
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    </button>

                    {/* Expanded CVE table */}
                    {isOpen && (
                      <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                              <th className="px-5 py-2.5 font-medium">Vulnerability</th>
                              <th className="px-5 py-2.5 font-medium">CVE ID</th>
                              <th className="px-5 py-2.5 font-medium">Severity</th>
                              <th className="px-5 py-2.5 font-medium">Fixed In</th>
                              <th className="px-5 py-2.5 font-medium">Source</th>
                              <th className="px-5 py-2.5 font-medium text-right">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plugin.vulns.map((v) => (
                              <tr
                                key={v.id}
                                className="border-b border-[var(--border)] last:border-0 bg-surface hover:bg-[var(--surface-subtle)] transition-colors"
                              >
                                {/* Vulnerability title */}
                                <td
                                  className="px-5 py-3 text-sm text-[var(--muted-foreground)] max-w-xs truncate"
                                  title={v.vuln_title}
                                >
                                  {v.vuln_title}
                                </td>

                                {/* CVE ID */}
                                <td className="px-5 py-3 text-sm font-mono">
                                  {v.cve_id ? (
                                    <span className="text-[var(--foreground)]">{v.cve_id}</span>
                                  ) : (
                                    <span className="text-[var(--muted)]">—</span>
                                  )}
                                </td>

                                {/* Severity */}
                                <td className="px-5 py-3 text-sm">
                                  <span
                                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${getSeverityStyles(v.severity)}`}
                                  >
                                    {v.severity}
                                  </span>
                                </td>

                                {/* Fixed In */}
                                <td className="px-5 py-3 text-sm font-mono">
                                  {v.fixed_in ? (
                                    <span className="text-[var(--success)] font-medium">v{v.fixed_in}</span>
                                  ) : (
                                    <span className="text-red-500 font-medium">Unpatched</span>
                                  )}
                                </td>

                                {/* Source */}
                                <td className="px-5 py-3 text-sm">
                                  <span className="rounded bg-[var(--surface-subtle)] border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--muted-foreground)] uppercase">
                                    {v.source}
                                  </span>
                                </td>

                                {/* Details */}
                                <td className="px-5 py-3 text-sm text-right">
                                  <a
                                    href={v.reference_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-700 whitespace-nowrap hover:bg-teal-100 transition-colors"
                                  >
                                    View Details
                                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
