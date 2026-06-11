export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getLoginEvents } from "@/lib/queries/events";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";
import { LoginsTable } from "@/components/dashboard/LoginsTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Download, KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

export default async function LoginsPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return (
      <EmptyState
        icon={KeyRound}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const companyId = profile.company_id;
  const loginEvents = await getLoginEvents(supabase, { companyId });

  return (
    <div className="space-y-6">
      <PageHeader title="Login Activity" subtitle={`${companyId} · Access Logs`} />
      

      {loginEvents.length === 0 ? (
        <EmptyState 
          icon={KeyRound}
          title="No login activity"
          description="Authentication events will appear here once users start logging in."
        />
      ) : (
        <LoginsTable initialEvents={loginEvents} />
      )}
    </div>
  );
}
