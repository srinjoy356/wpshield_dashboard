import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAlerts } from "@/lib/queries/alerts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { BellOff } from "lucide-react";
import { MarkAllReadButton } from "@/components/dashboard/MarkAllReadButton";
import { AlertsRealtimeWrapper } from "@/components/dashboard/AlertsRealtimeWrapper";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.company_id) {
    if (profile?.role === "admin" || profile?.role === "super_admin") redirect("/admin");
    return (
      <EmptyState
        icon={BellOff}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const alerts = await getAlerts(supabase, { companyId: profile.company_id });
  const openCount = alerts.filter((a) => a.status === "open").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        subtitle={`${profile.company_id} · Security Alerts`}
      >
        <MarkAllReadButton companyId={profile.company_id} openCount={openCount} />
      </PageHeader>
      <AlertsRealtimeWrapper
        initialAlerts={alerts}
        companyId={profile.company_id}
      />
    </div>
  );
}