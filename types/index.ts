// ═══════════════════════════════════════════════════════════════════
// Cybernara WPShield — Shared TypeScript Types
// ═══════════════════════════════════════════════════════════════════

export type CompanyStatus =
  | "active"
  | "pending"
  | "invited"
  | "onboarded"
  | "stale"
  | "suspended";

//extended type for away mode schedule (Srinjoy)
export interface Company {
  id: number;
  company_id: string;
  display_name: string;
  contact_email: string;
  status: CompanyStatus;
  onboarded_at: string;
  last_seen_at: string;
  total_events: number;
  site_url: string | null;
  // Added when fetched via getCompaniesWithTodayStats — real active site count and
  // the first one's URL, since a company can now have more than one site and
  // site_url alone only ever reflected a single legacy value.
  siteCount?: number;
  firstSiteUrl?: string | null;
  notes?: string;
  // Srinjoy: added fields for new settings
  maintenance_mode?: boolean;
  away_mode_schedule?: AwayModeSchedule | null;
  blocking_enabled?: boolean;
  uptime_status?: string | null;
  uptime_response_ms?: number | null;
  last_uptime_check?: string | null;
  safebrowsing_status?: string | null;
  last_safebrowsing_check?: string | null;
  notify_email?: string | null;
  notify_slack_webhook?: string | null;
  notify_severity_threshold?: "low" | "medium" | "high" | "critical" | null;
  xmlrpc_disabled?: boolean;
  // Srinjoy: added fields for agency white-labeling (Phase 5)
  whitelabel_logo_url?: string | null;
  whitelabel_agency_name?: string | null;
  auto_update_plugins?: boolean;
  whitelabel_footer_text?: string | null;
}

// New type for updating company settings away mode to block wp-admin (Srinjoy)
export interface AwayModeSchedule {
  enabled: boolean;
  timezone: string;
  allowed_days: number[]; // 0=Sun...6=Sat
  allowed_start: string; // "HH:MM"
  allowed_end: string; // "HH:MM"
  whitelist_ips: string[];
}

//New type for ip blocking for brute force (Srinjoy)
export interface BlockedIP {
  id: number;
  company_id: string;
  ip: string;
  reason: string | null;
  source: "manual" | "auto";
  is_active: boolean;
  blocked_at: string;
  expires_at: string | null;
}

//Srinjoy: added types for blocked countries
export interface BlockedCountry {
  id: number;
  company_id: string;
  country_code: string;
  country_name: string;
}

//Srinjoy: added types for file integrity monitoring
export interface WPActivity {
  id: number;
  company_id: string;
  site_id: string | null;
  site_url: string | null;
  action_type: string;
  user_login: string | null;
  user_id: number | null;
  severity: Severity;
  ip: string | null;
  details: Record<string, unknown> | null;
  occurred_at: string;
}

//Srinjoy: added types for notification payload
export interface NotifyPayload {
  company_id: string;
  alert_title: string;
  alert_description: string;
  severity: Severity;
  site_url?: string;
  dashboard_url?: string;
}

export interface PendingCompany {
  id: number;
  company_id: string;
  site_url: string;
  first_seen_at: string;
  last_seen_at: string;
  event_count: number;
}

export type Severity = "low" | "medium" | "high" | "critical";

export type PatternType =
  | "sqli"
  | "xss"
  | "lfi"
  | "rce"
  | "scanner_ua"
  | "sensitive_404"
  | "xmlrpc";

export interface AttackEvent {
  id: number;
  company_id: string;
  site_url: string;
  severity: Severity;
  pattern_type: PatternType;
  ip: string;
  request_method: string;
  request_uri: string;
  user_agent: string;
  occurred_at: string;
  raw_payload?: string;
  blocked: boolean;
}

export type LoginEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "role_changed"
  | "user_created";

export interface LoginEvent {
  id: number;
  company_id: string;
  site_url: string;
  event: string;
  login: string;
  ip: string;
  roles_json: string;
  severity: Severity;
  occurred_at: string;
}

export type FileEventType = "added" | "modified" | "deleted";

export interface FileEvent {
  id: number;
  company_id: string;
  site_url: string;
  event: string;
  path: string;
  size: number;
  old_hash?: string;
  new_hash?: string;
  severity: Severity;
  occurred_at: string;
}

export interface PluginInfo {
  slug: string;
  name: string;
  version: string;
  is_active: number | boolean;
  update_pending: number | boolean;
  new_version?: string;
}

export interface ThemeInfo {
  slug: string;
  name: string;
  version: string;
  is_active: number | boolean;
  update_pending: number | boolean;
  new_version?: string;
}

export interface InventorySnapshot {
  id: number;
  company_id: string;
  kind: "core" | "plugins" | "themes" | "test_ping";
  payload: any;
  occurred_at: string;
}

export interface InventorySnapshotView {
  core: any;
  plugins: PluginInfo[];
  themes: ThemeInfo[];
  pluginCount: number;
  themeCount: number;
  lastUpdated: string | null;
}

export type AlertStatus = "open" | "acknowledged" | "resolved";

export interface Alert {
  id: number;
  company_id: string;
  site_id?: string | null;
  site_url?: string | null;
  source_table: string;
  source_event_id: number;
  severity: Severity;
  title: string;
  description: string;
  status: AlertStatus;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  created_at: string;
}

export type ActivityAction =
  | "client.onboarded"
  | "client.suspended"
  | "client.unsuspended"
  | "client.deleted"
  | "client.password_reset"
  | "alert.acknowledged"
  | "alert.resolved"
  | "settings.updated";

export interface ActivityLog {
  id: number;
  actor_id: string;
  actor_name: string;
  actor_role?: string | null;
  action: ActivityAction;
  target_company_id?: string;
  target_company_name?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface UserProfile {
  id: string;
  company_id: string | null;
  role: "admin" | "client";
  display_name: string;
  email?: string | null;
}

// Chart data types
export interface TimeSeriesPoint {
  date: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface SeverityCount {
  name: string;
  value: number;
  color: string;
}

// Phase 5: Agency & Reporting Upgrades
export interface ReportHistory {
  id: number;
  company_id: string;
  report_type: "monthly" | "on-demand";
  status: string;
  generated_at: string;
}

export interface ScheduledReport {
  id: number;
  company_id: string;
  frequency: string;
  recipient_emails: string[];
  next_run_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ManagedReview {
  id: number;
  company_id: string;
  month_year: string;
  analyst_id: string | null;
  vulnerable_plugins_note: string | null;
  failed_hardening_note: string | null;
  suspicious_logins_note: string | null;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
}