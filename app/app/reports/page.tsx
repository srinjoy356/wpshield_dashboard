export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getWPActivityEvents } from "@/lib/queries/wpshield-activity";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ActivityTable } from "@/components/dashboard/ActivityTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { getPlanFeatures } from "@/lib/billing/get-plan-features";
import { Activity } from "lucide-react";
import { redirect } from "next/navigation";

export default async function ActivityPage() {
  const supabase = createClient();
  const profile  = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return <EmptyState icon={Activity} title="No company assigned" description="Your account is not yet linked to a company." />;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const features = await getPlanFeatures(supabase, user!.id);

  // Limited tier: last 7 days only
  const limitDays = features.activityLogsFull ? 90 : 7;
  const since = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString();

  const events = await getWPActivityEvents(supabase, {
    companyId: profile.company_id,
    since,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="User Activity" subtitle={`${profile.company_id} · WordPress Admin Actions`} />
      {!features.activityLogsFull && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
          <span className="font-semibold">Limited view:</span>
          Showing last 7 days only. Upgrade to Solo or above for full history.
          <a href="/app/billing" className="ml-auto font-semibold underline underline-offset-2">Upgrade</a>
        </div>
      )}
      {events.length === 0 ? (
        <EmptyState icon={Activity} title="No activity recorded yet"
          description="Ensure the WPShield plugin is active and running." />
      ) : (
        <ActivityTable initialEvents={events} />
      )}
    </div>
  );
}