export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getLatestInventoryByKind } from "@/lib/queries/events";
import { getCheckTargets } from "@/lib/queries/site-targets";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { InventoryList } from "@/components/dashboard/InventoryList";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { VulnerabilitiesList } from "@/components/dashboard/VulnerabilitiesList";
import { Package, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { SiteSwitcher } from "@/components/dashboard/SiteSwitcher";

interface Props {
  searchParams: Promise<{ site?: string }>;
}

export default async function InventoryPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
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

  const { data: company } = await supabase
    .from("companies")
    .select("site_url")
    .eq("company_id", companyId)
    .single();

  // Every active site under this company — a company with two sites previously only
  // ever saw whichever one's plugin happened to send the most recent snapshot, with
  // the other site's plugins/themes never shown at all regardless of vulnerabilities.
  const targets = await getCheckTargets(supabase, { company_id: companyId, site_url: company?.site_url });

  if (targets.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Site Inventory" subtitle={`${companyId} · Asset Management`} />
        <EmptyState
          icon={Package}
          title="No active site found"
          description="Activate your license on a WordPress site to start tracking inventory."
        />
      </div>
    );
  }

  // ?site=<id> selects which site to view; "legacy" represents the null-site_id
  // fallback target. Defaults to the first target if not specified or invalid.
  const siteKeyFor = (siteId: string | null) => siteId ?? "legacy";
  const requestedKey = resolvedSearchParams.site;
  const selectedTarget =
    targets.find((t) => siteKeyFor(t.site_id) === requestedKey) ?? targets[0];

  const snapshot = await getLatestInventoryByKind(supabase, companyId, selectedTarget.site_id);

  // Fetch active vulnerability alerts for the selected site
  let vulnQuery = supabase
    .from("wpshield_vuln_alerts")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  vulnQuery = selectedTarget.site_id
    ? vulnQuery.eq("site_id", selectedTarget.site_id)
    : vulnQuery.is("site_id", null);
  const { data: openVulns } = await vulnQuery;

  // Count unique vulnerable plugins (not raw CVE rows)
  const uniqueVulnPlugins = new Set((openVulns ?? []).map((v) => v.plugin_slug)).size;

  return (
    <div className="space-y-6">
      <PageHeader title="Site Inventory" subtitle={`${selectedTarget.url} · Asset Management`} />

      {targets.length > 1 && (
        <SiteSwitcher
          sites={targets.map((t) => ({ key: siteKeyFor(t.site_id), label: t.url }))}
          value={siteKeyFor(selectedTarget.site_id)}
          hrefFor={(key) => `/app/inventory?site=${key}`}
        />
      )}

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
          description="A snapshot of this site's software will appear here soon."
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