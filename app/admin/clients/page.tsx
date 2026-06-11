export const dynamic = 'force-dynamic';
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { ClientsList } from "@/components/dashboard/ClientsList";
import { createClient } from "@/lib/supabase/server";
import { getCompaniesWithTodayStats, getPendingCompanies } from "@/lib/queries/companies";
import {
  Clock,
  CheckCircle,
  ExternalLink,
  ArrowRight,
  Plus,
} from "lucide-react";

export default async function ClientsPage() {
  const supabase = createClient();
  
  const [companiesRaw, pendingCompanies] = await Promise.all([
    getCompaniesWithTodayStats(supabase),
    getPendingCompanies(supabase),
  ]);

  const companies = companiesRaw.map(c => ({
    ...c,
    total_events: c.todayEvents || 0
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Clients">
        <Link href="/admin/clients/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Manually add client
          </Button>
        </Link>
      </PageHeader>

      {/* Section 1: Pending Sites */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <Clock className="h-5 w-5 text-[var(--warning)] shrink-0" strokeWidth={1.5} />
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Pending Sites — awaiting onboarding ({pendingCompanies.length})
            </h2>
            <p className="text-sm text-[var(--muted)]">
              WPShield plugin is sending data from these sites, but no dashboard account
              has been created yet.
            </p>
          </div>
        </div>

        {pendingCompanies.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="No pending sites — all caught up! 🎉"
          />
        ) : (
          <div className="space-y-4">
            {pendingCompanies.map((pc) => (
              <div
                key={pc.company_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm"
              >
                <div>
                  <p className="font-mono text-lg font-semibold text-[var(--foreground)]">
                    {pc.company_id}
                  </p>
                  {pc.site_url && (
                    <a
                      href={pc.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      {pc.site_url}
                      <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                    </a>
                  )}
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    First seen: <TimeCell dateStr={pc.first_seen_at} className="text-xs" /> ·{" "}
                    {pc.event_count} events queued
                  </p>
                </div>
                <Link href={`/admin/clients/new?from=${pc.company_id}`}>
                  <Button size="sm">
                    Onboard
                    <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Onboarded Clients */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-[var(--success)]" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Onboarded Clients ({companies.length})
          </h2>
        </div>

        <ClientsList initialCompanies={companies} />
      </div>
    </div>
  );
}
