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

  // 4. Stale clients count (active but not seen in 24h). A company with real
  //    activated sites is only stale if every one of its active sites has gone
  //    quiet — companies.last_seen_at alone isn't reliable once real sites exist,
  //    since the heartbeat ingest route only refreshes sites.last_seen_at, not the
  //    company row, so a perfectly healthy multi-site company could otherwise show
  //    as stale here just because no plain security *event* fired in 24h.
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: activeCompaniesForStale } = await supabase
    .from("companies")
    .select("company_id, last_seen_at")
    .eq("status", "active");

  const { data: allActiveSites } = await supabase
    .from("sites")
    .select("company_id, last_seen_at")
    .eq("is_active", true);

  const siteSeenByCompany = new Map<string, string[]>();
  (allActiveSites || []).forEach((s) => {
    if (!s.last_seen_at) return;
    const arr = siteSeenByCompany.get(s.company_id) || [];
    arr.push(s.last_seen_at);
    siteSeenByCompany.set(s.company_id, arr);
  });

  let staleClients = 0;
  for (const c of activeCompaniesForStale || []) {
    const siteSeenTimes = siteSeenByCompany.get(c.company_id);
    if (siteSeenTimes && siteSeenTimes.length > 0) {
      const mostRecent = siteSeenTimes.reduce((latest, t) => (new Date(t) > new Date(latest) ? t : latest));
      if (new Date(mostRecent) < new Date(staleThreshold)) staleClients++;
    } else if (!c.last_seen_at || new Date(c.last_seen_at) < new Date(staleThreshold)) {
      staleClients++;
    }
  }

  return {
    activeClients: activeClients || 0,
    eventsToday,
    openAlerts: openAlerts || 0,
    staleClients,
  };
}

// Real, current count of sites that are down — counts the sites table directly for
// any company that's activated a real site (this is what uptime-check actually
// updates), and falls back to the legacy companies.uptime_status field only for
// companies that have never activated a site at all. The previous version only ever
// read companies.uptime_status, which freezes the moment a company gets a real site
// and stops reflecting reality.
export async function getSitesDownCount(supabase: SupabaseClient) {
  const { count: sitesDown } = await supabase
    .from("sites")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("uptime_status", "down");

  const { data: siteRows } = await supabase.from("sites").select("company_id");
  const companyIdsWithSites = new Set((siteRows || []).map((s) => s.company_id));

  const { data: downCompanies } = await supabase
    .from("companies")
    .select("company_id")
    .eq("status", "active")
    .eq("uptime_status", "down");

  const legacyDownCount = (downCompanies || []).filter((c) => !companyIdsWithSites.has(c.company_id)).length;

  return (sitesDown || 0) + legacyDownCount;
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