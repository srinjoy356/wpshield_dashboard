export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getWPActivityEvents } from "@/lib/queries/wpshield-activity";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ActivityTable } from "@/components/dashboard/ActivityTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Activity } from "lucide-react";
import { redirect } from "next/navigation";

export default async function ActivityPage() {
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return (
      <EmptyState
        icon={Activity}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const events = await getWPActivityEvents(supabase, {
    companyId: profile.company_id,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Activity"
        subtitle={`${profile.company_id} · WordPress Admin Actions`}
      />
      {events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity recorded yet"
          description="Ensure the WPShield plugin v2.0.0 is active and the user_activity checklist item is enabled in plugin settings."
        />
      ) : (
        <ActivityTable initialEvents={events} />
      )}
    </div>
  );
}