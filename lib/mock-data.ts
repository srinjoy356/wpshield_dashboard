// ═══════════════════════════════════════════════════════════════════
// Cybernara WPShield — Mock Data
// ═══════════════════════════════════════════════════════════════════

import {
  Company,
  PendingCompany,
  AttackEvent,
  LoginEvent,
  FileEvent,
  InventorySnapshot,
  Alert,
  TimeSeriesPoint,
  SeverityCount,
  Severity,
  PatternType,
  LoginEventType,
  FileEventType,
} from "@/types";

// ── Helpers ──────────────────────────────────────────────────────
function daysAgo(d: number, hours = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}
function hoursAgo(h: number): string {
  const date = new Date();
  date.setHours(date.getHours() - h);
  return date.toISOString();
}
function minsAgo(m: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - m);
  return date.toISOString();
}

// ── Companies ────────────────────────────────────────────────────
export const companies: Company[] = [
  {
    id: 1,
    company_id: "cybernara",
    display_name: "Cybernara",
    contact_email: "admin@cybernara.com",
    status: "active",
    onboarded_at: daysAgo(90),
    last_seen_at: minsAgo(2),
    total_events: 12847,
    site_url: "https://cybernara.com",
  },
  {
    id: 2,
    company_id: "acme",
    display_name: "ACME Corporation",
    contact_email: "security@acme.io",
    status: "active",
    onboarded_at: daysAgo(60),
    last_seen_at: minsAgo(15),
    total_events: 8234,
    site_url: "https://acme.io",
  },
  {
    id: 3,
    company_id: "techcorp",
    display_name: "TechCorp Solutions",
    contact_email: "it@techcorp.dev",
    status: "active",
    onboarded_at: daysAgo(45),
    last_seen_at: hoursAgo(1),
    total_events: 5621,
    site_url: "https://techcorp.dev",
  },
  {
    id: 4,
    company_id: "shopfast",
    display_name: "ShopFast Inc.",
    contact_email: "devops@shopfast.store",
    status: "stale",
    onboarded_at: daysAgo(30),
    last_seen_at: daysAgo(3),
    total_events: 2109,
    site_url: "https://shopfast.store",
  },
  {
    id: 5,
    company_id: "demoshop",
    display_name: "DemoShop",
    contact_email: "admin@demoshop.com",
    status: "suspended",
    onboarded_at: daysAgo(120),
    last_seen_at: daysAgo(14),
    total_events: 943,
    site_url: "https://demoshop.com",
    notes: "Suspended due to non-payment",
  },
];

// ── Pending Companies ────────────────────────────────────────────
export const pendingCompanies: PendingCompany[] = [
  {
    id: 1,
    company_id: "newclient1",
    site_url: "https://newclient1.com",
    first_seen_at: hoursAgo(2),
    last_seen_at: minsAgo(10),
    event_count: 47,
  },
  {
    id: 2,
    company_id: "testsite",
    site_url: "https://testsite.org",
    first_seen_at: daysAgo(1),
    last_seen_at: hoursAgo(6),
    event_count: 183,
  },
  {
    id: 3,
    company_id: "anothersite",
    site_url: "https://another-site.net",
    first_seen_at: daysAgo(5),
    last_seen_at: daysAgo(2),
    event_count: 512,
  },
];

// ── Attack Events (50) ───────────────────────────────────────────
const severities: Severity[] = ["low", "medium", "high", "critical"];
const patterns: PatternType[] = ["sqli", "xss", "lfi", "rce", "scanner_ua", "sensitive_404", "xmlrpc"];
const methods = ["GET", "POST", "PUT", "DELETE"];
const uris = [
  "/wp-login.php",
  "/wp-admin/admin-ajax.php",
  "/xmlrpc.php",
  "/wp-content/plugins/revslider/temp/update_extract/revslider/../../../wp-config.php",
  "/?author=1",
  "/wp-json/wp/v2/users",
  "/wp-content/uploads/../../etc/passwd",
  "/wp-admin/options-general.php",
  "/.env",
  "/wp-config.php.bak",
  "/wp-content/debug.log",
  "/readme.html",
];
const userAgents = [
  "Mozilla/5.0 (compatible; wpscan)",
  "sqlmap/1.7.2",
  "Nikto/2.1.6",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "python-requests/2.31.0",
  "curl/8.4.0",
  "Go-http-client/1.1",
  "Mozilla/5.0 (Linux; Android 13)",
];
const ips = [
  "192.168.1.42", "45.33.32.156", "104.248.52.91", "185.220.101.34",
  "91.121.209.170", "23.129.64.143", "198.51.100.17", "203.0.113.42",
  "172.16.254.1", "10.0.0.55", "89.248.167.131", "62.210.105.116",
];
const companyIds = ["cybernara", "acme", "techcorp", "shopfast", "demoshop"];

export const attackEvents: AttackEvent[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  company_id: companyIds[i % 5],
  site_url: companies[i % 5].site_url,
  severity: severities[Math.floor(Math.random() * 4)],
  pattern_type: patterns[Math.floor(Math.random() * 7)],
  ip: ips[Math.floor(Math.random() * 12)],
  request_method: methods[Math.floor(Math.random() * 4)],
  request_uri: uris[Math.floor(Math.random() * 12)],
  user_agent: userAgents[Math.floor(Math.random() * 8)],
  occurred_at: hoursAgo(Math.floor(Math.random() * 168)),
  blocked: Math.random() > 0.3,
})).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

// ── Login Events (30) ────────────────────────────────────────────
const loginTypes: LoginEventType[] = ["login_success", "login_failed", "logout", "role_changed", "user_created"];
const wpUsers = ["admin", "editor1", "john.doe", "jane.smith", "wp_manager", "content_writer"];

export const loginEvents: LoginEvent[] = Array.from({ length: 30 }, (_, i) => {
  const eventType = loginTypes[Math.floor(Math.random() * 5)];
  return {
    id: i + 1,
    company_id: companyIds[i % 5],
    site_url: companies[i % 5].site_url,
    event: eventType,
    login: wpUsers[Math.floor(Math.random() * 6)],
    ip: ips[Math.floor(Math.random() * 12)],
    roles_json: eventType === "role_changed" ? "subscriber→editor" : "administrator",
    severity: (eventType === "login_failed" ? "medium" : "low") as Severity,
    occurred_at: hoursAgo(Math.floor(Math.random() * 168)),
  };
}).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

// ── File Events (20) ─────────────────────────────────────────────
const fileTypes: FileEventType[] = ["added", "modified", "deleted"];
const filePaths = [
  "/wp-content/plugins/wpshield/wpshield.php",
  "/wp-config.php",
  "/wp-includes/version.php",
  "/wp-content/themes/flavor/functions.php",
  "/.htaccess",
  "/wp-content/uploads/2026/05/shell.php",
  "/wp-content/plugins/contact-form-7/readme.txt",
  "/index.php",
  "/wp-admin/install.php",
  "/wp-content/debug.log",
];

export const fileEvents: FileEvent[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  company_id: companyIds[i % 5],
  site_url: companies[i % 5].site_url,
  event: fileTypes[Math.floor(Math.random() * 3)],
  path: filePaths[Math.floor(Math.random() * 10)],
  size: Math.floor(Math.random() * 500000) + 100,
  old_hash: `a${Math.random().toString(36).substring(2, 10)}`,
  new_hash: `b${Math.random().toString(36).substring(2, 10)}`,
  severity: (i % 5 === 0 ? "high" : i % 3 === 0 ? "medium" : "low") as Severity,
  occurred_at: hoursAgo(Math.floor(Math.random() * 168)),
})).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

// ── Inventory Snapshots ──────────────────────────────────────────
export const inventorySnapshots: InventorySnapshot[] = [
  {
    id: 1,
    company_id: "cybernara",
    kind: 'core',
    payload: {
      wp_version: "6.9.4",
      php_version: "8.2.30",
      plugins: [
        { slug: "wpshield", name: "WPShield", version: "1.4.2", is_active: 1, update_pending: 0 },
        { slug: "wordpress-seo", name: "Yoast SEO", version: "23.1", is_active: 1, update_pending: 1, new_version: "23.4" },
      ],
      themes: [
        { slug: "flavor", name: "flavor", version: "3.4.0", is_active: 1, update_pending: 0 },
      ]
    },
    occurred_at: minsAgo(15),
  },
];

// ── Alerts (8) ───────────────────────────────────────────────────
export const alerts: Alert[] = [
  {
    id: 1,
    company_id: "cybernara",
    source_table: "wpshield_events_attack",
    source_event_id: 1,
    severity: "critical",
    title: "SQL Injection attempt from known malicious IP",
    description: "Detected SQLi payload in query parameter targeting wp-admin/admin-ajax.php. IP 45.33.32.156 is listed in threat intelligence feeds.",
    status: "open",
    created_at: minsAgo(12),
  },
  {
    id: 2,
    company_id: "acme",
    source_table: "wpshield_events_attack",
    source_event_id: 5,
    severity: "high",
    title: "Multiple RCE attempts detected",
    description: "Remote code execution payloads detected in POST requests. 12 attempts in the last hour from rotating IPs.",
    status: "open",
    created_at: minsAgo(45),
  },
  {
    id: 3,
    company_id: "cybernara",
    source_table: "wpshield_events_login",
    source_event_id: 2,
    severity: "high",
    title: "Brute force login attempt",
    description: "23 failed login attempts for user 'admin' from IP 91.121.209.170 in 5 minutes.",
    status: "open",
    created_at: hoursAgo(1),
  },
  {
    id: 4,
    company_id: "techcorp",
    source_table: "wpshield_events_file",
    source_event_id: 3,
    severity: "critical",
    title: "Suspicious file added to uploads directory",
    description: "File shell.php was added to wp-content/uploads/. This may indicate a web shell upload.",
    status: "open",
    created_at: hoursAgo(2),
  },
  {
    id: 5,
    company_id: "cybernara",
    source_table: "wpshield_events_attack",
    source_event_id: 8,
    severity: "medium",
    title: "XML-RPC pingback abuse",
    description: "XML-RPC endpoint receiving high volume of pingback requests, potentially used for DDoS amplification.",
    status: "open",
    created_at: hoursAgo(3),
  },
  {
    id: 6,
    company_id: "acme",
    source_table: "wpshield_events_attack",
    source_event_id: 12,
    severity: "high",
    title: "WPScan enumeration detected",
    description: "Automated WordPress scanner (wpscan) detected enumerating plugins and users.",
    status: "acknowledged",
    acknowledged_by: "admin-001",
    acknowledged_at: hoursAgo(1),
    created_at: hoursAgo(6),
  },
  {
    id: 7,
    company_id: "techcorp",
    source_table: "wpshield_events_login",
    source_event_id: 15,
    severity: "medium",
    title: "Unauthorized role change",
    description: "User 'editor1' role was changed from subscriber to editor without admin action.",
    status: "acknowledged",
    acknowledged_by: "admin-001",
    acknowledged_at: hoursAgo(4),
    created_at: hoursAgo(12),
  },
  {
    id: 8,
    company_id: "shopfast",
    source_table: "wpshield_events_file",
    source_event_id: 18,
    severity: "low",
    title: "WordPress core file modified",
    description: "wp-includes/version.php was modified. This is expected after a WordPress update.",
    status: "resolved",
    acknowledged_by: "admin-001",
    acknowledged_at: daysAgo(1),
    resolved_at: hoursAgo(20),
    created_at: daysAgo(2),
  },
];

// ── Activity Logs (15) ───────────────────────────────────────────
export const activityLogs = [
  { id: 1, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "client.created", target_company_id: "cybernara", target_company_name: "Cybernara", created_at: daysAgo(90) },
  { id: 2, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "client.created", target_company_id: "acme", target_company_name: "ACME Corporation", created_at: daysAgo(60) },
  { id: 3, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "client.created", target_company_id: "techcorp", target_company_name: "TechCorp Solutions", created_at: daysAgo(45) },
  { id: 4, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "client.created", target_company_id: "shopfast", target_company_name: "ShopFast Inc.", created_at: daysAgo(30) },
  { id: 5, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "client.suspended", target_company_id: "demoshop", target_company_name: "DemoShop", metadata: { reason: "Non-payment" }, created_at: daysAgo(14) },
  { id: 6, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "alert.acknowledged", target_company_id: "acme", target_company_name: "ACME Corporation", metadata: { alert_id: 6 }, created_at: hoursAgo(1) },
  { id: 7, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "alert.acknowledged", target_company_id: "techcorp", target_company_name: "TechCorp Solutions", metadata: { alert_id: 7 }, created_at: hoursAgo(4) },
  { id: 8, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "alert.resolved", target_company_id: "shopfast", target_company_name: "ShopFast Inc.", metadata: { alert_id: 8 }, created_at: hoursAgo(20) },
  { id: 9, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "password.reset", target_company_id: "acme", target_company_name: "ACME Corporation", created_at: daysAgo(7) },
  { id: 10, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "settings.updated", metadata: { setting: "alert_threshold", old: "5", new: "10" }, created_at: daysAgo(5) },
  { id: 11, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "client.created", target_company_id: "demoshop", target_company_name: "DemoShop", created_at: daysAgo(120) },
  { id: 12, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "client.reactivated", target_company_id: "shopfast", target_company_name: "ShopFast Inc.", created_at: daysAgo(10) },
  { id: 13, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "settings.updated", metadata: { setting: "retention_days", old: "30", new: "90" }, created_at: daysAgo(3) },
  { id: 14, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "password.reset", target_company_id: "techcorp", target_company_name: "TechCorp Solutions", created_at: daysAgo(2) },
  { id: 15, actor_id: "admin-001", actor_name: "Prithvi (Admin)", action: "alert.resolved", target_company_id: "cybernara", target_company_name: "Cybernara", metadata: { alert_id: 5 }, created_at: hoursAgo(8) },
].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

// ═══════════════════════════════════════════════════════════════════
// Filter & Stat Helpers
// ═══════════════════════════════════════════════════════════════════

export function getEventsForCompany(companyId: string, type: 'attack' | 'login' | 'file') {
  switch (type) {
    case 'attack': return attackEvents.filter(e => e.company_id === companyId);
    case 'login': return loginEvents.filter(e => e.company_id === companyId);
    case 'file': return fileEvents.filter(e => e.company_id === companyId);
  }
}

export function getAlertsForCompany(companyId: string) {
  return alerts.filter(a => a.company_id === companyId);
}

export function getStatsForCompany(companyId: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const attacks = attackEvents.filter(e => e.company_id === companyId);
  const todayAttacks = attacks.filter(e => new Date(e.occurred_at) >= today);
  const openAlerts = alerts.filter(a => a.company_id === companyId && a.status === 'open');
  const company = companies.find(c => c.company_id === companyId);

  return {
    eventsToday: todayAttacks.length + loginEvents.filter(e => e.company_id === companyId && new Date(e.occurred_at) >= today).length,
    openAlerts: openAlerts.length,
    totalEvents: company?.total_events ?? 0,
    status: company?.status ?? 'active',
    lastSeen: company?.last_seen_at ?? '',
  };
}

export function getRecentEvents(limit: number) {
  return attackEvents.slice(0, limit);
}

export function getGlobalStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activeClients = companies.filter(c => c.status === 'active').length;
  const todayEvents = attackEvents.filter(e => new Date(e.occurred_at) >= today).length;
  const openAlerts = alerts.filter(a => a.status === 'open').length;
  const staleClients = companies.filter(c => c.status === 'stale').length;

  return { activeClients, todayEvents, openAlerts, staleClients };
}

// ── Chart Data ───────────────────────────────────────────────────
export function getTimeSeriesData(_companyId?: string): TimeSeriesPoint[] {
  const days = 7;
  const data: TimeSeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    data.push({
      date: dateStr,
      low: Math.floor(Math.random() * 40) + 10,
      medium: Math.floor(Math.random() * 25) + 5,
      high: Math.floor(Math.random() * 15) + 2,
      critical: Math.floor(Math.random() * 5) + 1,
    });
  }
  return data;
}

export function getSeverityDistribution(companyId?: string): SeverityCount[] {
  const events = companyId
    ? attackEvents.filter(e => e.company_id === companyId)
    : attackEvents;
  return [
    { name: "Low", value: events.filter(e => e.severity === "low").length, color: "#15803D" },
    { name: "Medium", value: events.filter(e => e.severity === "medium").length, color: "#A16207" },
    { name: "High", value: events.filter(e => e.severity === "high").length, color: "#C2410C" },
    { name: "Critical", value: events.filter(e => e.severity === "critical").length, color: "#B91C1C" },
  ];
}
