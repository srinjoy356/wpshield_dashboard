import { createClient } from "@/lib/supabase/server";
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
  const [company, attacks, logins, files, inventory, alerts, timeData, severityData] = await Promise.all([
    getCompanyWithStats(supabase, companyId),
    getAttackEvents(supabase, { companyId }),
    getLoginEvents(supabase, { companyId }),
    getFileEvents(supabase, { companyId }),
    getLatestInventoryByKind(supabase, companyId),
    getAlerts(supabase, { companyId }),
    getTimeSeriesStats(supabase, companyId),
    getSeverityStats(supabase, companyId),
  ]);

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
      defaultTab={initialTab}
    />
  );
}
