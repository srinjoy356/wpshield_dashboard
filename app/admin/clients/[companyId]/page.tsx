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
  // License info for the admin "License" tab. Two sources, merged:
  //
  // 1. sites.license_id — licenses already activated on a WordPress site.
  // 2. companies.contact_email -> customers.email -> subscriptions -> licenses
  //    — EVERY license this company has ever been issued, activated or not.
  //
  // Source 2 is the one that actually matters for this feature: a customer
  // who paid but never received/activated their key (the exact scenario the
  // reveal/resend flow exists for) has no row in `sites` at all yet, so
  // deriving licenses only from already-activated sites would silently hide
  // precisely the customers support most needs to look up. There's no formal
  // foreign key between `companies` (the security-product side of the schema)
  // and `customers`/`subscriptions`/`licenses` (the billing side) — they're
  // two systems joined only by matching the same email string, which is a
  // real structural gap in the schema, not something this query can fix.
  // It's the best linkage available right now.
  const licenseIdsFromSites = new Set(sites.map(s => s.license_id).filter(Boolean) as string[]);

  let licenses: any[] = [];
  if (company?.contact_email) {
    const adminSupabase = createAdminClient();

    const { data: billingCustomer } = await adminSupabase
      .from('customers')
      .select('id')
      .eq('email', company.contact_email)
      .maybeSingle();

    let licenseRows: any[] = [];
    if (billingCustomer) {
      const { data: subs } = await adminSupabase
        .from('subscriptions')
        .select('id')
        .eq('customer_id', billingCustomer.id);

      const subIds = (subs || []).map(s => s.id);
      if (subIds.length > 0) {
        const { data: rows } = await adminSupabase
          .from('licenses')
          .select('id, subscription_id, status, max_sites, delivery_status, delivery_error, last_delivery_attempt_at, created_at, encrypted_key')
          .in('subscription_id', subIds);
        licenseRows = rows || [];
      }
    }

    // Merge in any license referenced by a site but not already covered above
    // (shouldn't normally happen given the email join, but kept as a safety
    // net rather than silently dropping a license sites.license_id points to).
    const coveredIds = new Set(licenseRows.map(l => l.id));
    const missingFromSites = [...licenseIdsFromSites].filter(id => !coveredIds.has(id));
    if (missingFromSites.length > 0) {
      const { data: extra } = await adminSupabase
        .from('licenses')
        .select('id, subscription_id, status, max_sites, delivery_status, delivery_error, last_delivery_attempt_at, created_at, encrypted_key')
        .in('id', missingFromSites);
      licenseRows = [...licenseRows, ...(extra || [])];
    }

    licenses = licenseRows.map(l => ({
      ...l,
      hasRecoverableKey: !!l.encrypted_key,
      encrypted_key: undefined,
      // Surfaces the same "activated on a real site yet?" signal the user's
      // own diagnostic script already checks — a license can be perfectly
      // valid and never have been entered into WordPress yet.
      isActivated: licenseIdsFromSites.has(l.id),
    }));
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