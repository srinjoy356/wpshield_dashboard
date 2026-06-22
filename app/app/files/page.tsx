export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getFileEvents } from "@/lib/queries/events";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { FilesTable } from "@/components/dashboard/FilesTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { UpgradeLock } from "@/components/billing/UpgradeGate";
import { getPlanFeatures } from "@/lib/billing/get-plan-features";
import { FileSearch } from "lucide-react";
import { redirect } from "next/navigation";

export default async function FilesPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return <EmptyState icon={FileSearch} title="No company assigned" description="Your account is not yet linked to a company." />;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const features = await getPlanFeatures(supabase, user!.id);

  const companyId = profile.company_id;

  // Limited tier: last 7 days only, no download
  const limitDays = features.fileIntegrityFull ? 90 : 7;
  const since = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString();
  const fileEvents = await getFileEvents(supabase, { companyId, since });

  return (
    <div className="space-y-6">
      <PageHeader
        title="File Integrity"
        subtitle={`${companyId} · Change Monitoring`}
      />
      {!features.fileIntegrityFull && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
          <span className="font-semibold">Limited view:</span>
          Showing last 7 days only. Upgrade to Solo or above for 90-day history and CSV export.
          <a href="/app/billing" className="ml-auto font-semibold underline underline-offset-2">Upgrade</a>
        </div>
      )}
      {fileEvents.length === 0 ? (
        <EmptyState icon={FileSearch} title="No file changes" description="Your WordPress core and plugin files are unchanged." />
      ) : (
        <FilesTable initialEvents={fileEvents} />
      )}
    </div>
  );
}