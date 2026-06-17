"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Shield, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, HelpCircle, Lock, ShieldAlert, Puzzle, Activity, HeartPulse, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface HardeningResult {
  check_key: string;
  check_name: string;
  category: string;
  status: "pass" | "fail" | "unknown";
  priority: "high" | "medium" | "low";
  description: string;
  recommendation: string;
  score_impact: number;
  last_checked_at: string;
}

interface EvidenceData {
  company: {
    site_url: string;
    uptime_response_ms: number;
    last_uptime_check: string;
    last_seen_at: string;
  };
  criticalAlerts: Array<{ title: string; created_at: string }>;
  highAlerts: Array<{ title: string; created_at: string }>;
  vulnAlerts: Array<{
    plugin_name: string;
    plugin_version: string;
    cve_id: string | null;
    severity: string;
    fixed_in: string | null;
    reference_url: string;
  }>;
  fileAlerts: Array<{ title: string; created_at: string }>;
}

export interface SiteBundle {
  site_id: string | null;
  site_url: string;
  initialResults: HardeningResult[];
  evidence: EvidenceData;
}

interface HardeningContentProps {
  companyId: string;
  sites: SiteBundle[];
}

const DEFAULT_CHECKS = [
  { key: "https_enforced", name: "HTTPS Enforced", category: "Network", priority: "high", score_impact: 15, description: "Your site is not using HTTPS. All traffic is unencrypted.", recommendation: "Install an SSL certificate and force HTTPS on your site." },
  { key: "no_critical_open_alerts", name: "No Critical Open Alerts", category: "Alerts", priority: "high", score_impact: 20, description: "You have unresolved critical security alerts on your site.", recommendation: "Review and resolve all critical alerts immediately." },
  { key: "no_vulnerable_plugins", name: "No Vulnerable Plugins", category: "Plugins", priority: "high", score_impact: 20, description: "One or more plugins have known security vulnerabilities.", recommendation: "Update all flagged plugins to their fixed versions immediately." },
  { key: "uptime_healthy", name: "Uptime Healthy", category: "Availability", priority: "high", score_impact: 15, description: "Your site is currently offline or unreachable.", recommendation: "Check your hosting provider and restore your site immediately." },
  { key: "plugin_heartbeat_recent", name: "Plugin Heartbeat Recent", category: "Monitoring", priority: "medium", score_impact: 10, description: "WPShield plugin has not sent data in over 24 hours.", recommendation: "Check if the WPShield plugin is active and properly configured." },
  { key: "no_high_open_alerts", name: "No High Open Alerts", category: "Alerts", priority: "medium", score_impact: 10, description: "You have many unresolved high severity alerts.", recommendation: "Review and acknowledge or resolve high severity alerts." },
  { key: "no_file_modification_alerts", name: "No Recent File Modification Alerts", category: "Files", priority: "medium", score_impact: 10, description: "Unexpected file modifications detected on your site recently.", recommendation: "Review all file change alerts and verify they were authorized." },
];

const FAIL_NAMES: Record<string, string> = {
  no_vulnerable_plugins: "Vulnerable Plugins Detected",
  no_high_open_alerts: "Too Many High Severity Alerts Open",
  no_critical_open_alerts: "Critical Alerts Unresolved",
  no_file_modification_alerts: "Recent File Modifications Detected",
  uptime_healthy: "Site Offline or Unreachable",
  plugin_heartbeat_recent: "Plugin Not Reporting Data",
  https_enforced: "HTTPS Not Configured",
};

function getMaturityBadge(score: number) {
  if (score <= 40) return { text: "Critical Risk", color: "bg-red-50 text-red-700 border-red-200", iconName: "critical" };
  if (score <= 60) return { text: "Needs Attention", color: "bg-orange-50 text-orange-700 border-orange-200", iconName: "warning" };
  if (score <= 80) return { text: "Moderate", color: "bg-yellow-50 text-yellow-700 border-yellow-200", iconName: "moderate" };
  if (score <= 90) return { text: "Good", color: "bg-green-50 text-green-700 border-green-200", iconName: "good" };
  return { text: "Excellent", color: "bg-teal-50 text-teal-700 border-teal-200", iconName: "check" };
}

function MaturityIcon({ name, className }: { name: string; className?: string }) {
  const cls = cn("h-3.5 w-3.5 shrink-0", className);
  switch (name) {
    case "critical": return <XCircle className={cls} />;
    case "warning":  return <ShieldAlert className={cls} />;
    case "moderate": return <HelpCircle className={cls} />;
    case "good":     return <CheckCircle2 className={cls} />;
    case "check":    return <CheckCircle2 className={cls} />;
    default:         return null;
  }
}

export function HardeningContent({ companyId, sites }: HardeningContentProps) {
  const [siteBundles, setSiteBundles] = useState<SiteBundle[]>(sites);
  const [selectedSiteIndex, setSelectedSiteIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // If this company has no sites to check at all, siteBundles is empty — guard
  // against that rather than assuming index 0 always exists.
  const current = siteBundles[selectedSiteIndex];
  const results = current?.initialResults || [];
  const evidence = current?.evidence;

  const mergedChecks = useMemo(() => {
    return DEFAULT_CHECKS.map((def) => {
      const match = results.find((r) => r.check_key === def.key);
      return {
        ...def,
        status: match ? match.status : "unknown",
        description:
          match && match.status === "pass"
            ? "Check passed successfully."
            : match
              ? match.description
              : def.description,
        recommendation:
          match && match.status === "pass"
            ? "No action required."
            : match
              ? match.recommendation
              : def.recommendation,
        last_checked_at: match ? match.last_checked_at : null,
      };
    });
  }, [results]);

  const score = useMemo(() => {
    return mergedChecks.reduce(
      (sum, c) => (c.status === "pass" ? sum + c.score_impact : sum),
      0
    );
  }, [mergedChecks]);

  const latestCheckedAt = useMemo(() => {
    const dates = results
      .map((r) => r.last_checked_at)
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates));
  }, [results]);

  const [timeAgo, setTimeAgo] = useState("never");

  useEffect(() => {
    function updateTimeAgo() {
      if (!latestCheckedAt) {
        setTimeAgo("never");
        return;
      }
      const diffMs = Date.now() - latestCheckedAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) {
        setTimeAgo("just now");
      } else if (diffMins === 1) {
        setTimeAgo("1 minute ago");
      } else {
        setTimeAgo(`${diffMins} minutes ago`);
      }
    }

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 30000);
    return () => clearInterval(interval);
  }, [latestCheckedAt]);

  const handleRunAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/hardening-audit");
      const data = await res.json();
      if (data.success) {
        const { data: newResults } = await supabase
          .from("wpshield_hardening_results")
          .select("*")
          .eq("company_id", companyId);
        if (newResults) {
          // Re-bucket the company-wide result set back into each site's own bundle —
          // a single audit run covers every active site under this company at once.
          setSiteBundles((prev) =>
            prev.map((bundle) => ({
              ...bundle,
              initialResults: (newResults as (HardeningResult & { site_id: string | null })[]).filter(
                (r) => r.site_id === bundle.site_id
              ),
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to run audit:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const renderEvidence = (key: string, isPass: boolean) => {
    switch (key) {
      case "https_enforced": {
        const siteUrl = evidence?.company?.site_url || "—";
        return isPass ? (
          <p className="text-emerald-600 font-semibold">Site URL: {siteUrl} is secured with HTTPS</p>
        ) : (
          <p className="text-red-600 font-semibold">Site URL: {siteUrl} does not use HTTPS</p>
        );
      }
      case "no_critical_open_alerts": {
        const criticals = evidence?.criticalAlerts || [];
        return isPass ? (
          <p className="text-emerald-600 font-semibold">0 critical alerts currently open</p>
        ) : (
          <div className="space-y-2">
            <p className="text-red-600 font-bold">{criticals.length} critical alerts currently open — review immediately</p>
            {criticals.length > 0 && (
              <ul className="list-disc list-inside space-y-1 mt-1 text-[11px] text-[var(--muted)]">
                {criticals.slice(0, 3).map((a, idx) => (
                  <li key={idx}>
                    <span className="font-medium text-[var(--foreground)]">{a.title}</span> (Opened {new Date(a.created_at).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }
      case "no_high_open_alerts": {
        const highs = evidence?.highAlerts || [];
        return isPass ? (
          <p className="text-emerald-600 font-semibold">High severity alerts are within acceptable limit</p>
        ) : (
          <div className="space-y-2">
            <p className="text-orange-600 font-bold">{highs.length} high severity alerts currently open</p>
            {highs.length > 0 && (
              <ul className="list-disc list-inside space-y-1 mt-1 text-[11px] text-[var(--muted)]">
                {highs.slice(0, 5).map((a, idx) => (
                  <li key={idx}>
                    <span className="font-medium text-[var(--foreground)]">{a.title}</span> (Opened {new Date(a.created_at).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }
      case "no_vulnerable_plugins": {
        const vulns = evidence?.vulnAlerts || [];
        return isPass ? (
          <p className="text-emerald-600 font-semibold">All plugins are clean — no known CVEs detected</p>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            <p className="text-red-600 font-bold">{vulns.length} vulnerabilities detected in active plugins</p>
            {vulns.length > 0 && (
              <table className="w-full text-left border-collapse mt-2 text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="py-1.5 font-semibold">Plugin Name</th>
                    <th className="py-1.5 font-semibold">Version</th>
                    <th className="py-1.5 font-semibold">CVE ID</th>
                    <th className="py-1.5 font-semibold">Severity</th>
                    <th className="py-1.5 font-semibold">Fixed In</th>
                    <th className="py-1.5 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {vulns.map((v, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-subtle)] transition-colors">
                      <td className="py-1.5 font-medium text-[var(--foreground)]">{v.plugin_name}</td>
                      <td className="py-1.5 font-mono">{v.plugin_version || "—"}</td>
                      <td className="py-1.5 font-mono">{v.cve_id || "—"}</td>
                      <td className="py-1.5">
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                          v.severity?.toLowerCase() === "critical"
                            ? "bg-red-50 text-red-700 border border-red-100"
                            : v.severity?.toLowerCase() === "high"
                            ? "bg-orange-50 text-orange-700 border border-orange-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        )}>
                          {v.severity}
                        </span>
                      </td>
                      <td className="py-1.5 font-mono text-emerald-600 font-medium">{v.fixed_in ? `v${v.fixed_in}` : "Unpatched"}</td>
                      <td className="py-1.5 text-right">
                        <a
                          href={v.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      }
      case "uptime_healthy": {
        const responseMs = evidence?.company?.uptime_response_ms || 0;
        const lastCheck = evidence?.company?.last_uptime_check 
          ? new Date(evidence.company.last_uptime_check).toLocaleString()
          : "never";
        return isPass ? (
          <p className="text-emerald-600 font-semibold">Site responded in {responseMs}ms — last checked {lastCheck}</p>
        ) : (
          <p className="text-red-600 font-semibold">Site is not responding — last checked {lastCheck}</p>
        );
      }
      case "plugin_heartbeat_recent": {
        const lastSeen = evidence?.company?.last_seen_at 
          ? new Date(evidence.company.last_seen_at).toLocaleString()
          : "never";
        return isPass ? (
          <p className="text-emerald-600 font-semibold">Last data received: {lastSeen}</p>
        ) : (
          <p className="text-red-600 font-semibold">No data received since {lastSeen} — plugin may be inactive</p>
        );
      }
      case "no_file_modification_alerts": {
        const files = evidence?.fileAlerts || [];
        return isPass ? (
          <p className="text-emerald-600 font-semibold">No file modifications detected in last 7 days</p>
        ) : (
          <div className="space-y-2">
            <p className="text-orange-600 font-bold">{files.length} file modifications detected in last 7 days</p>
            {files.length > 0 && (
              <ul className="list-disc list-inside space-y-1 mt-1 text-[11px] text-[var(--muted)]">
                {files.slice(0, 5).map((a, idx) => (
                  <li key={idx}>
                    <span className="font-medium text-[var(--foreground)]">{a.title}</span> (Detected {new Date(a.created_at).toLocaleString()})
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const badge = getMaturityBadge(score);
  const categories = ["Network", "Alerts", "Plugins", "Availability", "Monitoring", "Files"];

  if (siteBundles.length === 0) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <PageHeader title="Security Hardening" subtitle={`${companyId} · Vulnerability Audit`} />
        <div className="rounded-2xl border border-[var(--border)] bg-surface p-8 text-center text-sm text-[var(--muted)]">
          No active site found for this account yet. Activate your license on a WordPress site to start running hardening audits.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Security Hardening"
        subtitle={`${current?.site_url || companyId} · Vulnerability Audit`}
      />

      {siteBundles.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {siteBundles.map((bundle, idx) => (
            <button
              key={bundle.site_id ?? `legacy-${idx}`}
              onClick={() => {
                setSelectedSiteIndex(idx);
                setExpandedKey(null);
              }}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors",
                idx === selectedSiteIndex
                  ? "bg-[#B8B0AA] text-neutral-900 border-neutral-950"
                  : "bg-surface text-[var(--muted)] border-[var(--border)] hover:bg-[var(--surface-subtle)]"
              )}
            >
              {bundle.site_url}
            </button>
          ))}
        </div>
      )}

      {/* Hero Scoreboard card with horizontal split inside */}
      <div className="rounded-2xl border border-[var(--border)] bg-premium-surface p-8 shadow-sm relative overflow-hidden">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-500 to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-10 items-center">
          {/* LEFT SIDE (40% / 4 cols) */}
          <div className="md:col-span-4 flex flex-col items-center text-center space-y-4 border-b border-[var(--border)] pb-6 md:border-b-0 md:pb-0 md:border-r md:pr-8">
            <div className="rounded-full bg-[#B8B0AA] border border-neutral-950 p-4 shadow-sm">
              <Shield className="h-10 w-10 text-neutral-950" strokeWidth={1.5} />
            </div>

            <div className="space-y-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-sm font-bold border shadow-sm",
                  badge.color
                )}
              >
                <MaturityIcon name={badge.iconName} />
                {badge.text}
              </span>
              <h2 className="text-4xl font-extrabold text-[var(--foreground)] tracking-tight mt-2">
                {score} <span className="text-lg font-semibold text-[var(--muted)]">/ 100 points</span>
              </h2>
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-[var(--muted)] font-medium">
                Last audited: <span className="font-semibold text-[var(--foreground)]">{timeAgo}</span>
              </p>

              <Button
                onClick={handleRunAudit}
                disabled={loading}
                className="mt-2 h-10 px-6 font-semibold bg-[#B8B0AA] text-neutral-900 hover:bg-[#a69d97] transition-all rounded-full gap-2 shadow-sm border-0 flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Audit...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Run Audit Now
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* RIGHT SIDE (60% / 6 cols) */}
          <div className="md:col-span-6 space-y-4 md:pl-4">
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--muted)]">
              What gets scanned
            </h3>
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2.5 rounded-xl bg-[#C0B8B2] px-4 py-3.5 border border-[var(--border)] shadow-sm">
                <Lock size={22} className="text-black shrink-0" />
                <span className="text-[15px] font-semibold text-black">HTTPS & SSL Certificate</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#C0B8B2] px-4 py-3.5 border border-[var(--border)] shadow-sm">
                <ShieldAlert size={22} className="text-black shrink-0" />
                <span className="text-[15px] font-semibold text-black">Critical & High Security Alerts</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#C0B8B2] px-4 py-3.5 border border-[var(--border)] shadow-sm">
                <Puzzle size={22} className="text-black shrink-0" />
                <span className="text-[15px] font-semibold text-black">Plugin Vulnerabilities (CVE Check)</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#C0B8B2] px-4 py-3.5 border border-[var(--border)] shadow-sm">
                <Activity size={22} className="text-black shrink-0" />
                <span className="text-[15px] font-semibold text-black">Site Uptime & Availability</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#C0B8B2] px-4 py-3.5 border border-[var(--border)] shadow-sm">
                <HeartPulse size={22} className="text-black shrink-0" />
                <span className="text-[15px] font-semibold text-black">WPShield Plugin Heartbeat</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#C0B8B2] px-4 py-3.5 border border-[var(--border)] shadow-sm">
                <FileWarning size={22} className="text-black shrink-0" />
                <span className="text-[15px] font-semibold text-black">Recent File Modifications</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Checklist */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-[var(--foreground)] border-b border-[var(--border)] pb-2">
          Audit Checklist
        </h3>

        <div className="space-y-6">
          {categories.map((category) => {
            const categoryChecks = mergedChecks.filter((c) => c.category === category);
            if (categoryChecks.length === 0) return null;

            return (
              <div
                key={category}
                className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-hidden"
              >
                <div className="bg-[var(--surface-subtle)] px-6 py-3 border-b border-[var(--border)]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    {category}
                  </h4>
                </div>

                <div className="divide-y divide-[var(--border)]">
                  {categoryChecks.map((check) => {
                    const isExpanded = expandedKey === check.key;
                    const isPass = check.status === "pass";
                    const isFail = check.status === "fail";
                    const displayName = (isFail && FAIL_NAMES[check.key]) ? FAIL_NAMES[check.key] : check.name;

                    return (
                      <div key={check.key} className="transition-all duration-200">
                        {/* Check Row */}
                        <div
                          onClick={() => toggleExpand(check.key)}
                          className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isPass ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            ) : isFail ? (
                              <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                            ) : (
                              <HelpCircle className="h-5 w-5 text-gray-400 shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-bold text-[var(--foreground)]">
                                {displayName}
                              </p>
                              <span className="text-[10px] text-[var(--muted)]">
                                Impact: +{check.score_impact} pts
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {isPass ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 border bg-teal-50 text-teal-600 border-teal-100">
                                Passed
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 border",
                                  check.priority === "high"
                                    ? "bg-red-50 text-red-600 border-red-100"
                                    : check.priority === "medium"
                                    ? "bg-amber-50 text-amber-600 border-amber-100"
                                    : "bg-blue-50 text-blue-600 border-blue-100"
                                )}
                              >
                                {check.priority}
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-[var(--muted)]" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
                            )}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-6 py-4 bg-[var(--surface-subtle)] border-t border-[var(--border)] space-y-3 animate-in slide-in-from-top-1 duration-150">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                                Description
                              </p>
                              <p className="text-sm text-[var(--foreground)]">
                                {check.description}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                                Recommendation
                              </p>
                              <p className="text-sm font-medium text-[var(--foreground)] bg-surface border border-[var(--border)] rounded-lg p-3 shadow-inner">
                                {check.recommendation}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                                Evidence
                              </p>
                              <div className="text-xs p-3 bg-surface border border-[var(--border)] rounded-lg shadow-inner bg-slate-50/50">
                                {renderEvidence(check.key, isPass)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}