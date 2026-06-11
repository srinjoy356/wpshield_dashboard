"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, Trash2, Shield, ShieldOff, Loader2 } from "lucide-react";
import { Company, BlockedIP } from "@/types";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { EmptyState } from "@/components/dashboard/EmptyState";

interface Props {
  company: Company;
}

export function BlockingManager({ company }: Props) {
  const { toast } = useToast();
  const [blockingEnabled, setBlockingEnabled] = useState(
    company.blocking_enabled ?? false
  );
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [loadingIPs, setLoadingIPs] = useState(true);
  const [togglingBlock, setTogglingBlock] = useState(false);

  // Add IP form state
  const [ipInput, setIpInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [addingIP, setAddingIP] = useState(false);

  // Deletion loading state — tracks which row id is being deleted
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ── Fetch blocked IPs ─────────────────────────────────────────────────────
  const fetchIPs = useCallback(async () => {
    setLoadingIPs(true);
    try {
      const res = await fetch(
        `/api/blocking/ips?company_id=${encodeURIComponent(company.company_id)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBlockedIPs(data.data ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingIPs(false);
    }
  }, [company.company_id, toast]);

  useEffect(() => {
    fetchIPs();
  }, [fetchIPs]);

  // ── Toggle blocking_enabled ───────────────────────────────────────────────
  async function handleToggleBlocking(newValue: boolean) {
    setTogglingBlock(true);
    try {
      const res = await fetch("/api/settings/blocking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: newValue,
          company_id: company.company_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBlockingEnabled(newValue);
      toast({
        title: newValue ? "Active blocking enabled" : "Active blocking disabled",
        description: newValue
          ? "The plugin will enforce IP blocks on the next config sync."
          : "IP blocks are no longer enforced at the WordPress level.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTogglingBlock(false);
    }
  }

  // ── Add a blocked IP ─────────────────────────────────────────────────────
  async function handleAddIP() {
    const ip = ipInput.trim();
    if (!ip) return;

    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4.test(ip)) {
      toast({ title: "Invalid IP", description: "Enter a valid IPv4 address.", variant: "destructive" });
      return;
    }

    setAddingIP(true);
    try {
      const res = await fetch("/api/blocking/ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.company_id,
          ip,
          reason: reasonInput.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIpInput("");
      setReasonInput("");
      await fetchIPs(); // refresh the list
      toast({ title: "IP blocked", description: `${ip} has been added to the blocklist.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingIP(false);
    }
  }

  // ── Remove a blocked IP ───────────────────────────────────────────────────
  async function handleRemoveIP(id: number, ip: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/blocking/ips", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, company_id: company.company_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBlockedIPs((prev) => prev.filter((b) => b.id !== id));
      toast({ title: "IP unblocked", description: `${ip} has been removed from the blocklist.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-[var(--surface-subtle)] p-1.5">
            {blockingEnabled
              ? <Shield className="h-4 w-4 text-[#0D9488]" strokeWidth={1.5} />
              : <ShieldOff className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
            }
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Active Blocking</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              When enabled, the WPShield plugin enforces the blocklist below at the WordPress level,
              returning 403 to matched IPs.
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={blockingEnabled}
          disabled={togglingBlock}
          onClick={() => handleToggleBlocking(!blockingEnabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
            blockingEnabled ? "bg-[#0D9488]" : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              blockingEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Warning: verify own IP */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" strokeWidth={1.5} />
        <p className="text-sm text-amber-800">
          <strong>Before enabling:</strong> verify your own IP address is not in the blocklist below.
          Blocking your own IP will lock you out of wp-admin.
        </p>
      </div>

      {/* Add IP form */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm font-medium text-[var(--foreground)] mb-3">Block an IP Address</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="IPv4 address — e.g. 203.0.113.42"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddIP()}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddIP()}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
          />
          <button
            onClick={handleAddIP}
            disabled={addingIP || !ipInput.trim()}
            className="flex items-center gap-2 rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {addingIP
              ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              : <Plus className="h-4 w-4" strokeWidth={1.5} />
            }
            Block IP
          </button>
        </div>
      </div>

      {/* Blocked IPs table */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Blocked IPs
            {blockedIPs.length > 0 && (
              <span className="ml-2 rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs text-[var(--muted)]">
                {blockedIPs.length}
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {blockingEnabled ? "Enforced by plugin" : "Not enforced — blocking is off"}
          </p>
        </div>

        {loadingIPs ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
          </div>
        ) : blockedIPs.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No blocked IPs"
            description="Add IP addresses above to populate the blocklist."
            className="border-0 rounded-none py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                  <th className="px-5 py-3 font-medium">IP Address</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Blocked At</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {blockedIPs.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-sm text-[var(--foreground)]">
                      {entry.ip}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--muted)]">
                      {entry.reason ?? <span className="italic text-[var(--muted)]">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        entry.source === "auto"
                          ? "bg-blue-50 text-[var(--info)]"
                          : "bg-[var(--surface-subtle)] text-[var(--muted)]"
                      }`}>
                        {entry.source === "auto" ? "Auto" : "Manual"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--muted)]">
                      <TimeCell dateStr={entry.blocked_at} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleRemoveIP(entry.id, entry.ip)}
                        disabled={deletingId === entry.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingId === entry.id
                          ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                          : <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                        }
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}