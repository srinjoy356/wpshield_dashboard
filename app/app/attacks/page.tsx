export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getAttackEvents } from "@/lib/queries/events";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";
import { AttacksTable } from "@/components/dashboard/AttacksTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Download, Swords } from "lucide-react";
import { redirect } from "next/navigation";

export default async function AttacksPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return (
      <EmptyState
        icon={Swords}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const companyId = profile.company_id;
  const attackEvents = await getAttackEvents(supabase, { companyId });

  return (
    <div className="space-y-6">
      <PageHeader title="Attack Events" subtitle={`${companyId} · Security Monitoring`} />
      

      {attackEvents.length === 0 ? (
        <EmptyState 
          icon={Swords}
          title="No attacks detected"
          description="Your site is clean! No security threats have been detected yet."
        />
      ) : (
        <AttacksTable initialEvents={attackEvents} />
      )}
    </div>
  );
}
