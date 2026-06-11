export const dynamic = 'force-dynamic';
"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/auth/use-user";
import { getAlerts } from "@/lib/queries/alerts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { BellOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { MarkAllReadButton } from "@/components/dashboard/MarkAllReadButton";
import { Alert } from "@/types";

export default function ClientAlertsPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    console.log("[AlertsPage] useEffect trigger", { userLoading, profileId: profile?.id, companyId: profile?.company_id });
    let isMounted = true;

    if (userLoading) {
      console.log("[AlertsPage] Returning early because userLoading is true");
      return;
    }

    if (!profile || !profile.company_id) {
      console.log("[AlertsPage] Returning early due to missing profile/company", { profile });
      if (profile?.role === "admin") {
        router.replace("/admin");
      }
      if (isMounted) setAlertsLoading(false);
      return;
    }

    const companyId = profile.company_id;

    async function loadAlerts() {
      console.log("[AlertsPage] Fetching alerts for company:", companyId);
      try {
        const data = await getAlerts(supabase, { companyId });
        console.log("[AlertsPage] Fetched data count:", data?.length);
        if (isMounted) setAlerts(data);
      } catch (err) {
        console.error("[AlertsPage] Failed to load alerts:", err);
      } finally {
        console.log("[AlertsPage] loadAlerts finally, isMounted:", isMounted);
        if (isMounted) setAlertsLoading(false);
      }
    }

    loadAlerts();

    const channel = supabase
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newAlert = payload.new as Alert;
          setAlerts((prev) => [newAlert, ...prev]);
        }
      )
      .subscribe((status) => {
        if (!isMounted) return;
        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
        } else {
          setRealtimeConnected(false);
        }
      });

    return () => {
      console.log("[AlertsPage] Unmounting effect");
      isMounted = false;
      channel.unsubscribe();
    };
  }, [userLoading, profile?.company_id, profile?.role, supabase, router]);

  if (!userLoading && !alertsLoading && (!profile || !profile.company_id)) {
    return (
      <EmptyState
        icon={BellOff}
        title="No company assigned"
        description="Your account is not yet linked to a company."
      />
    );
  }

  const openCount = alerts.filter((a) => a.status === "open").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Alerts
            {(userLoading || alertsLoading) && (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
            )}
            {realtimeConnected && !userLoading && !alertsLoading && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </span>
            )}
          </span>
        }
        subtitle={profile?.company_id ? `${profile.company_id} · Security Alerts` : undefined}
      >
        {!userLoading && !alertsLoading && profile?.company_id && (
          <MarkAllReadButton companyId={profile.company_id} openCount={openCount} />
        )}
      </PageHeader>

      {userLoading || alertsLoading ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-4 border border-[var(--border)] border-dashed rounded-2xl bg-[var(--surface-subtle)]/50">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted-foreground)]">Loading alerts...</p>
        </div>
      ) : (
        <AlertsList initialAlerts={alerts} isAdmin={false} />
      )}
    </div>
  );
}
