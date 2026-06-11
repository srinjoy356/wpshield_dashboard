import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getLatestInventoryByKind } from "@/lib/queries/events";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { InventoryList } from "@/components/dashboard/InventoryList";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { VulnerabilitiesList } from "@/components/dashboard/VulnerabilitiesList";
import { Package, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

export default async function InventoryPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return (
      <EmptyState
        icon={Package}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const companyId = profile.company_id;
  const snapshot = await getLatestInventoryByKind(supabase, companyId);

  // Fetch active vulnerability alerts for this company
  const { data: openVulns } = await supabase
    .from("wpshield_vuln_alerts")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  // Count unique vulnerable plugins (not raw CVE rows)
  const uniqueVulnPlugins = new Set((openVulns ?? []).map((v) => v.plugin_slug)).size;

  return (
    <div className="space-y-6">
      <PageHeader title="Site Inventory" subtitle={`${companyId} · Asset Management`} />

      {openVulns && openVulns.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">{uniqueVulnPlugins} vulnerable plugin{uniqueVulnPlugins > 1 ? "s" : ""} found.</span> Please review the open vulnerabilities below and update the affected assets.
          </div>
        </div>
      )}

      {!snapshot ? (
        <EmptyState
          icon={Package}
          title="No inventory data"
          description="A snapshot of your site's software will appear here soon."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm text-center">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">WordPress Version</p>
              <span className="inline-block rounded-lg bg-[var(--surface-subtle)] px-4 py-2 text-2xl font-semibold">
                {snapshot.core?.wp_version ?? "Unknown"}
              </span>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Last checked: <TimeCell dateStr={snapshot.lastUpdated ?? ""} className="text-xs" />
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm text-center">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">PHP Version</p>
              <span className="inline-block rounded-lg bg-[var(--surface-subtle)] px-4 py-2 text-2xl font-semibold">
                {snapshot.core?.php_version ?? "Unknown"}
              </span>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm text-center">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Last Snapshot</p>
              <span className="text-2xl font-semibold">
                {snapshot.lastUpdated ? <TimeCell dateStr={snapshot.lastUpdated} /> : "—"}
              </span>
            </div>
          </div>

          <InventoryList snapshot={snapshot} />

          <hr className="border-[var(--border)] my-8" />

          <VulnerabilitiesList vulnerabilities={openVulns ?? []} />
        </>
      )}
    </div>
  );
}

