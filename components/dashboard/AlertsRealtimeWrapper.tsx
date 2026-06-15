"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { Alert } from "@/types";

interface Props {
  initialAlerts: Alert[];
  companyId: string;
}

export function AlertsRealtimeWrapper({ initialAlerts, companyId }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const supabase = createClient();

  useEffect(() => {
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
        (payload) => setAlerts((prev) => [payload.new as Alert, ...prev])
      )
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));

    return () => { channel.unsubscribe(); };
  }, [companyId, supabase]);

  return (
    <div>
      {realtimeConnected && (
        <div className="flex items-center gap-1.5 mb-3 w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>
          Live
        </div>
      )}
      <AlertsList initialAlerts={alerts} isAdmin={false} />
    </div>
  );
}