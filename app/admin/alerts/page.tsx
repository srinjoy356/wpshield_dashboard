export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getAlerts, getCompanyAlertSummaries } from "@/lib/queries/alerts";
import { AdminAlertsContent } from "./components/AdminAlertsContent";

export default async function AdminAlertsPage() {
  const supabase = createClient();
  
  const [alerts, summaries] = await Promise.all([
    getAlerts(supabase),
    getCompanyAlertSummaries(supabase),
  ]);

  return (
    <AdminAlertsContent 
      initialAlerts={alerts} 
      summaries={summaries} 
    />
  );
}
