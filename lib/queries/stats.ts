import { SupabaseClient } from "@supabase/supabase-js";

export async function getDashboardStats(supabase: SupabaseClient) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // 1. Active clients count
  const { count: activeClients } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // 2. Events today across all tables
  const tables = [
    "wpshield_events_attack",
    "wpshield_events_login",
    "wpshield_events_file",
    "wpshield_inventory_snapshots",
  ];

  const todayEventsCounts = await Promise.all(
    tables.map(async (table) => {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .gte("occurred_at", today);
      return count || 0;
    })
  );
  const eventsToday = todayEventsCounts.reduce((a, b) => a + b, 0);

  // 3. Open alerts count
  const { count: openAlerts } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  // 4. Stale sites count (Active but not seen in 24h)
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count: staleClients } = await supabase
    .from("companies")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .lt("last_seen_at", staleThreshold);

  return {
    activeClients: activeClients || 0,
    eventsToday,
    openAlerts: openAlerts || 0,
    staleClients: staleClients || 0,
  };
}

export async function getClientStats(supabase: SupabaseClient, companyId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const eventTables = [
    "wpshield_events_attack",
    "wpshield_events_login",
    "wpshield_events_file",
    "wpshield_inventory_snapshots",
  ] as const;

  // Fetch per-table today counts in parallel
  const [attacksToday, loginsToday, filesToday, inventoryToday] = await Promise.all(
    eventTables.map(async (table) => {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .gte("occurred_at", today);
      return count || 0;
    })
  );

  const eventsToday = attacksToday + loginsToday + filesToday + inventoryToday;

  const { count: openAlerts } = await supabase
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "open");

  const { data: company } = await supabase
    .from("companies")
    .select("last_seen_at, status")
    .eq("company_id", companyId)
    .single();

  return {
    eventsToday,
    attacksToday,
    loginsToday,
    filesToday,
    inventoryToday,
    openAlerts: openAlerts || 0,
    status: company?.status || "active",
    lastSeen: company?.last_seen_at || null,
  };
}

export async function getTimeSeriesStats(supabase: SupabaseClient, companyId?: string) {
  const days = 7;
  const now = new Date();
  const startOfPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const startIso = startOfPeriod.toISOString();

  // Fetch from all 3 event tables in parallel
  const [attackRes, loginRes, fileRes] = await Promise.all([
    companyId
      ? supabase.from("wpshield_events_attack").select("occurred_at, severity").eq("company_id", companyId).gte("occurred_at", startIso)
      : supabase.from("wpshield_events_attack").select("occurred_at, severity").gte("occurred_at", startIso),
    companyId
      ? supabase.from("wpshield_events_login").select("occurred_at, severity").eq("company_id", companyId).gte("occurred_at", startIso)
      : supabase.from("wpshield_events_login").select("occurred_at, severity").gte("occurred_at", startIso),
    companyId
      ? supabase.from("wpshield_events_file").select("occurred_at, severity").eq("company_id", companyId).gte("occurred_at", startIso)
      : supabase.from("wpshield_events_file").select("occurred_at, severity").gte("occurred_at", startIso),
  ]);

  // Combine all events
  const allEvents = [
    ...(attackRes.data || []),
    ...(loginRes.data || []),
    ...(fileRes.data || []),
  ];

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
    const dateStr = dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const dayEvents = allEvents.filter(e => {
      const d = new Date(e.occurred_at);
      return d >= dayStart && d < dayEnd;
    });

    result.push({
      date: dateStr,
      low: dayEvents.filter(e => e.severity === "low").length,
      medium: dayEvents.filter(e => e.severity === "medium").length,
      high: dayEvents.filter(e => e.severity === "high").length,
      critical: dayEvents.filter(e => e.severity === "critical").length,
    });
  }

  return result;
}

export async function getSeverityStats(supabase: SupabaseClient, companyId?: string) {
  const severities = [
    { name: "Low", key: "low", color: "#15803D" },
    { name: "Medium", key: "medium", color: "#A16207" },
    { name: "High", key: "high", color: "#C2410C" },
    { name: "Critical", key: "critical", color: "#B91C1C" },
  ];

  // Fetch from all 3 event tables in parallel
  const [attackRes, loginRes, fileRes] = await Promise.all([
    companyId
      ? supabase.from("wpshield_events_attack").select("severity").eq("company_id", companyId)
      : supabase.from("wpshield_events_attack").select("severity"),
    companyId
      ? supabase.from("wpshield_events_login").select("severity").eq("company_id", companyId)
      : supabase.from("wpshield_events_login").select("severity"),
    companyId
      ? supabase.from("wpshield_events_file").select("severity").eq("company_id", companyId)
      : supabase.from("wpshield_events_file").select("severity"),
  ]);

  const allEvents = [
    ...(attackRes.data || []),
    ...(loginRes.data || []),
    ...(fileRes.data || []),
  ];

  return severities.map(s => ({
    name: s.name,
    value: allEvents.filter(e => e.severity === s.key).length,
    color: s.color,
  }));
}
