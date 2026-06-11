import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getFileEvents } from "@/lib/queries/events";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TimeRangeTabs } from "@/components/dashboard/TimeRangeTabs";
import { FilesTable } from "@/components/dashboard/FilesTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Download, FileSearch } from "lucide-react";
import { redirect } from "next/navigation";

export default async function FilesPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile || !profile.company_id) {
    if (profile?.role === "admin") redirect("/admin");
    return (
      <EmptyState
        icon={FileSearch}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const companyId = profile.company_id;
  const fileEvents = await getFileEvents(supabase, { companyId });

  return (
    <div className="space-y-6">
      <PageHeader title="File Integrity" subtitle={`${companyId} · Change Monitoring`} />
      

      {fileEvents.length === 0 ? (
        <EmptyState 
          icon={FileSearch}
          title="No file changes"
          description="Your WordPress core and plugin files are unchanged."
        />
      ) : (
        <FilesTable initialEvents={fileEvents} />
      )}
    </div>
  );
}
