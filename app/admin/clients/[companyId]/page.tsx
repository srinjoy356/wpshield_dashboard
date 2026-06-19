export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyWithStats } from "@/lib/queries/companies";
import { getAttackEvents, getLoginEvents, getFileEvents, getLatestInventoryByKind } from "@/lib/queries/events";
import { getAlerts } from "@/lib/queries/alerts";
import { getTimeSeriesStats, getSeverityStats } from "@/lib/queries/stats";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { User } from "lucide-react";
import { ClientDetailClient } from "./components/ClientDetailClient";

interface Props {
  params: Promise<{
    companyId: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ClientDetailPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const resolvedSearchParams = await searchParams;
  const initialTab = (resolvedSearchParams.tab as string) || "overview";
  const supabase = createClient();
  
  // ... fetch data code ...
  // Also fetch sites for this company
  const sitesQuery = supabase
    .from('sites')
    .select('id, url, is_active, normalized_domain, last_seen_at, created_at, deactivated_at, license_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  const [company, attacks, logins, files, inventory, alerts, timeData, severityData, sitesResult] = await Promise.all([
    getCompanyWithStats(supabase, companyId),
    getAttackEvents(supabase, { companyId }),
    getLoginEvents(supabase, { companyId }),
    getFileEvents(supabase, { companyId }),
    getLatestInventoryByKind(supabase, companyId),
    getAlerts(supabase, { companyId }),
    getTimeSeriesStats(supabase, companyId),
    getSeverityStats(supabase, companyId),
    sitesQuery,
  ]);
  const sites = sitesResult.data || [];

  // License info for the new admin "License" tab — only fetched for the
  // distinct license_ids actually present on this company's sites, so a
  // company with no licenses (e.g. test/dev accounts) does zero extra work.
  const licenseIds = [...new Set(sites.map(s => s.license_id).filter(Boolean))] as string[];
  let licenses: any[] = [];
  if (licenseIds.length > 0) {
    // licenses has no authenticated-read RLS policy (migration 016 locks it to
    // service_role only) — same reason app/app/billing/page.tsx already has to
    // use the admin client for this table. The session client would silently
    // return zero rows here, not an error, which is exactly the kind of bug
    // that's easy to miss in testing if you don't already know about it.
    const adminSupabase = createAdminClient();
    const { data: licenseRows } = await adminSupabase
      .from('licenses')
      .select('id, status, max_sites, delivery_status, delivery_error, last_delivery_attempt_at, created_at, encrypted_key')
      .in('id', licenseIds);
    licenses = (licenseRows || []).map(l => ({ ...l, hasRecoverableKey: !!l.encrypted_key, encrypted_key: undefined }));
  }

  if (!company) {
    return (
      <EmptyState
        icon={User}
        title="Client not found"
        description={`No client with ID "${companyId}" was found in our records.`}
      />
    );
  }

  return (
    <ClientDetailClient
      company={company}
      attacks={attacks}
      logins={logins}
      files={files}
      inventory={inventory}
      alerts={alerts}
      timeData={timeData}
      severityData={severityData}
      sites={sites}
      licenses={licenses}
      defaultTab={initialTab}
    />
  );
}