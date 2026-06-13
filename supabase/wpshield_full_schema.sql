-- ============================================================
-- WPShield Complete Schema Creation Script
-- Run on a fresh Supabase project to recreate everything
-- ============================================================

-- Helper functions (required by RLS policies)
-- Function: create_alert_from_attack_event
-- Function: create_alert_from_file_event
-- Function: create_alert_from_login_event
-- Function: detect_pending_company
-- Function: get_user_company_id
-- Function: is_admin

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid();
$$;

-- Sequences (for bigint auto-increment columns)
CREATE SEQUENCE IF NOT EXISTS activity_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS alerts_id_seq;
CREATE SEQUENCE IF NOT EXISTS companies_id_seq;
CREATE SEQUENCE IF NOT EXISTS pending_companies_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_blocked_countries_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_blocked_ips_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_events_activity_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_events_attack_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_events_file_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_events_login_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_hardening_results_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_inventory_snapshots_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_uptime_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS wpshield_vuln_alerts_id_seq;

CREATE TABLE IF NOT EXISTS activity_logs (
  id bigint NOT NULL DEFAULT nextval('activity_logs_id_seq'::regclass),
  actor_id uuid,
  action text NOT NULL,
  target_company_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id bigint NOT NULL DEFAULT nextval('alerts_id_seq'::regclass),
  company_id text NOT NULL,
  source_table text,
  source_event_id bigint,
  severity text,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'::text,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS client_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + '24:00:00'::interval),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  id bigint NOT NULL DEFAULT nextval('companies_id_seq'::regclass),
  company_id text NOT NULL,
  display_name text NOT NULL,
  contact_email text,
  status text NOT NULL DEFAULT 'active'::text,
  onboarded_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  notes text,
  site_url text,
  uptime_status text DEFAULT 'unknown'::text,
  uptime_response_ms integer,
  last_uptime_check timestamptz,
  maintenance_mode boolean NOT NULL DEFAULT false,
  away_mode_schedule jsonb,
  blocking_enabled boolean NOT NULL DEFAULT false,
  notify_email text,
  notify_slack_webhook text,
  notify_severity_threshold text DEFAULT 'high'::text,
  xmlrpc_disabled boolean DEFAULT false,
  safebrowsing_status text DEFAULT 'unknown'::text,
  last_safebrowsing_check timestamptz,
  whitelabel_logo_url text,
  whitelabel_agency_name text,
  whitelabel_footer_text text,
  footer_attribution boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id uuid,
  email text NOT NULL,
  country text,
  provider_customer_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  region_type text NOT NULL DEFAULT 'india'::text,
  customer_type text NOT NULL DEFAULT 'site_owner'::text
);

CREATE TABLE IF NOT EXISTS entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id text,
  feature_key text NOT NULL,
  feature_value jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid,
  provider_invoice_id text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid,
  key_hash text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  max_sites integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS managed_reviews (
  id bigint NOT NULL,
  company_id text NOT NULL,
  month_year text NOT NULL,
  analyst_id text,
  vulnerable_plugins_note text,
  failed_hardening_note text,
  suspicious_logins_note text,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mfa_codes (
  user_id uuid NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_checkouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id text NOT NULL,
  txn_ref text NOT NULL,
  expected_amount_inr integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pending_companies (
  id bigint NOT NULL DEFAULT nextval('pending_companies_id_seq'::regclass),
  company_id text NOT NULL,
  site_url text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  event_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  id text NOT NULL,
  price_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  price numeric,
  max_sites integer NOT NULL DEFAULT 1,
  plan_family text NOT NULL DEFAULT 'solo'::text,
  price_usd numeric NOT NULL DEFAULT 10.00,
  price_inr_test integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS plugin_releases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  version text NOT NULL,
  changelog text,
  zip_path text NOT NULL,
  zip_url text NOT NULL,
  is_latest boolean NOT NULL DEFAULT false,
  released_by uuid,
  released_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_history (
  id bigint NOT NULL,
  company_id text NOT NULL,
  report_type text NOT NULL,
  status text DEFAULT 'success'::text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id bigint NOT NULL,
  company_id text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly'::text,
  recipient_emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_run_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid,
  token_prefix text NOT NULL,
  token_hash text NOT NULL,
  revoked boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id text,
  license_id uuid,
  url text NOT NULL,
  plugin_version text,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  is_active boolean NOT NULL DEFAULT true,
  normalized_domain text,
  deactivated_at timestamptz
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid,
  plan_id text,
  provider_subscription_id text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid NOT NULL,
  company_id text,
  role text NOT NULL DEFAULT 'client'::text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS wpshield_blocked_countries (
  id bigint NOT NULL DEFAULT nextval('wpshield_blocked_countries_id_seq'::regclass),
  company_id text NOT NULL,
  country_code text NOT NULL,
  country_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_blocked_ips (
  id bigint NOT NULL DEFAULT nextval('wpshield_blocked_ips_id_seq'::regclass),
  company_id text NOT NULL,
  ip text NOT NULL,
  reason text,
  source text DEFAULT 'manual'::text,
  is_active boolean NOT NULL DEFAULT true,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS wpshield_events_activity (
  id bigint NOT NULL DEFAULT nextval('wpshield_events_activity_id_seq'::regclass),
  company_id text NOT NULL,
  site_url text,
  severity text NOT NULL DEFAULT 'low'::text,
  action_type text NOT NULL,
  user_id integer,
  user_login text,
  ip text,
  details jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_events_attack (
  id bigint NOT NULL DEFAULT nextval('wpshield_events_attack_id_seq'::regclass),
  company_id text NOT NULL,
  site_url text NOT NULL,
  severity text NOT NULL,
  pattern_type text NOT NULL,
  ip text,
  method text,
  uri text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_events_file (
  id bigint NOT NULL DEFAULT nextval('wpshield_events_file_id_seq'::regclass),
  company_id text NOT NULL,
  site_url text NOT NULL,
  severity text NOT NULL,
  event text NOT NULL,
  path text NOT NULL,
  old_hash text,
  new_hash text,
  size bigint,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_events_login (
  id bigint NOT NULL DEFAULT nextval('wpshield_events_login_id_seq'::regclass),
  company_id text NOT NULL,
  site_url text NOT NULL,
  severity text NOT NULL,
  event text NOT NULL,
  user_id bigint,
  login text,
  ip text,
  roles_json text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_hardening_results (
  id bigint NOT NULL DEFAULT nextval('wpshield_hardening_results_id_seq'::regclass),
  company_id text NOT NULL,
  check_key text NOT NULL,
  check_name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  priority text NOT NULL DEFAULT 'medium'::text,
  description text,
  recommendation text,
  score_impact integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_inventory_snapshots (
  id bigint NOT NULL DEFAULT nextval('wpshield_inventory_snapshots_id_seq'::regclass),
  company_id text NOT NULL,
  site_url text NOT NULL,
  severity text NOT NULL DEFAULT 'low'::text,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_uptime_logs (
  id bigint NOT NULL DEFAULT nextval('wpshield_uptime_logs_id_seq'::regclass),
  company_id text NOT NULL,
  site_url text,
  status text NOT NULL,
  response_ms integer,
  status_code integer,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wpshield_vuln_alerts (
  id bigint NOT NULL DEFAULT nextval('wpshield_vuln_alerts_id_seq'::regclass),
  company_id text NOT NULL,
  plugin_slug text NOT NULL,
  plugin_name text,
  plugin_version text,
  vuln_title text NOT NULL,
  vuln_id text,
  severity text,
  cvss_score numeric,
  cve_id text,
  source text,
  fixed_in text,
  reference_url text,
  status text NOT NULL DEFAULT 'open'::text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PRIMARY KEYS
ALTER TABLE activity_logs ADD PRIMARY KEY (id);
ALTER TABLE alerts ADD PRIMARY KEY (id);
ALTER TABLE api_audit_logs ADD PRIMARY KEY (id);
ALTER TABLE client_invitations ADD PRIMARY KEY (id);
ALTER TABLE companies ADD PRIMARY KEY (id);
ALTER TABLE customers ADD PRIMARY KEY (id);
ALTER TABLE entitlements ADD PRIMARY KEY (id);
ALTER TABLE invoices ADD PRIMARY KEY (id);
ALTER TABLE licenses ADD PRIMARY KEY (id);
ALTER TABLE managed_reviews ADD PRIMARY KEY (id);
ALTER TABLE mfa_codes ADD PRIMARY KEY (user_id);
ALTER TABLE pending_checkouts ADD PRIMARY KEY (id);
ALTER TABLE pending_companies ADD PRIMARY KEY (id);
ALTER TABLE plans ADD PRIMARY KEY (id);
ALTER TABLE plugin_releases ADD PRIMARY KEY (id);
ALTER TABLE report_history ADD PRIMARY KEY (id);
ALTER TABLE scheduled_reports ADD PRIMARY KEY (id);
ALTER TABLE site_tokens ADD PRIMARY KEY (id);
ALTER TABLE sites ADD PRIMARY KEY (id);
ALTER TABLE subscriptions ADD PRIMARY KEY (id);
ALTER TABLE user_profiles ADD PRIMARY KEY (id);
ALTER TABLE webhook_events ADD PRIMARY KEY (id);
ALTER TABLE wpshield_blocked_countries ADD PRIMARY KEY (id);
ALTER TABLE wpshield_blocked_ips ADD PRIMARY KEY (id);
ALTER TABLE wpshield_events_activity ADD PRIMARY KEY (id);
ALTER TABLE wpshield_events_attack ADD PRIMARY KEY (id);
ALTER TABLE wpshield_events_file ADD PRIMARY KEY (id);
ALTER TABLE wpshield_events_login ADD PRIMARY KEY (id);
ALTER TABLE wpshield_hardening_results ADD PRIMARY KEY (id);
ALTER TABLE wpshield_inventory_snapshots ADD PRIMARY KEY (id);
ALTER TABLE wpshield_uptime_logs ADD PRIMARY KEY (id);
ALTER TABLE wpshield_vuln_alerts ADD PRIMARY KEY (id);

-- FOREIGN KEYS
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_actor_id_fkey_profiles FOREIGN KEY (actor_id) REFERENCES user_profiles(id);
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_target_company_id_fkey FOREIGN KEY (target_company_id) REFERENCES companies(company_id);
ALTER TABLE entitlements ADD CONSTRAINT entitlements_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id);
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE licenses ADD CONSTRAINT licenses_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id);
ALTER TABLE managed_reviews ADD CONSTRAINT managed_reviews_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(company_id);
ALTER TABLE pending_checkouts ADD CONSTRAINT pending_checkouts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id);
ALTER TABLE report_history ADD CONSTRAINT report_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(company_id);
ALTER TABLE scheduled_reports ADD CONSTRAINT scheduled_reports_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(company_id);
ALTER TABLE site_tokens ADD CONSTRAINT site_tokens_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id);
ALTER TABLE sites ADD CONSTRAINT sites_license_id_fkey FOREIGN KEY (license_id) REFERENCES licenses(id);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(company_id);

-- INDEXES
CREATE INDEX idx_activity_logs_actor_created ON public.activity_logs USING btree (actor_id, created_at DESC);
CREATE INDEX idx_alerts_company_created ON public.alerts USING btree (company_id, created_at DESC);
CREATE INDEX idx_alerts_status ON public.alerts USING btree (status);
CREATE UNIQUE INDEX companies_company_id_key ON public.companies USING btree (company_id);
CREATE INDEX idx_companies_company_id ON public.companies USING btree (company_id);
CREATE UNIQUE INDEX managed_reviews_company_id_month_year_key ON public.managed_reviews USING btree (company_id, month_year);
CREATE INDEX pending_checkouts_txn_ref_idx ON public.pending_checkouts USING btree (txn_ref);
CREATE UNIQUE INDEX pending_checkouts_txn_ref_key ON public.pending_checkouts USING btree (txn_ref);
CREATE INDEX pending_checkouts_user_id_idx ON public.pending_checkouts USING btree (user_id);
CREATE INDEX idx_pending_companies_company_id ON public.pending_companies USING btree (company_id);
CREATE INDEX idx_pending_companies_last_seen ON public.pending_companies USING btree (last_seen_at DESC);
CREATE UNIQUE INDEX pending_companies_company_id_key ON public.pending_companies USING btree (company_id);
CREATE INDEX plugin_releases_is_latest_idx ON public.plugin_releases USING btree (is_latest);
CREATE UNIQUE INDEX plugin_releases_version_key ON public.plugin_releases USING btree (version);
CREATE UNIQUE INDEX scheduled_reports_company_id_key ON public.scheduled_reports USING btree (company_id);
CREATE UNIQUE INDEX unique_provider_subscription_id ON public.subscriptions USING btree (provider_subscription_id);
CREATE INDEX idx_user_profiles_company_id ON public.user_profiles USING btree (company_id);
CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);
CREATE UNIQUE INDEX webhook_events_provider_event_id_key ON public.webhook_events USING btree (provider_event_id);
CREATE INDEX idx_blocked_countries_company ON public.wpshield_blocked_countries USING btree (company_id);
CREATE UNIQUE INDEX wpshield_blocked_countries_company_id_country_code_key ON public.wpshield_blocked_countries USING btree (company_id, country_code);
CREATE INDEX idx_blocked_ips_company ON public.wpshield_blocked_ips USING btree (company_id, is_active);
CREATE UNIQUE INDEX wpshield_blocked_ips_company_id_ip_address_key ON public.wpshield_blocked_ips USING btree (company_id, ip);
CREATE INDEX idx_activity_company ON public.wpshield_events_activity USING btree (company_id, occurred_at DESC);
CREATE INDEX idx_attack_company_time ON public.wpshield_events_attack USING btree (company_id, occurred_at DESC);
CREATE INDEX idx_attack_pattern ON public.wpshield_events_attack USING btree (pattern_type);
CREATE INDEX idx_attack_severity ON public.wpshield_events_attack USING btree (severity);
CREATE INDEX idx_file_company_time ON public.wpshield_events_file USING btree (company_id, occurred_at DESC);
CREATE INDEX idx_file_path ON public.wpshield_events_file USING btree (path);
CREATE INDEX idx_login_company_time ON public.wpshield_events_login USING btree (company_id, occurred_at DESC);
CREATE INDEX idx_login_event ON public.wpshield_events_login USING btree (event);
CREATE INDEX idx_hardening_company ON public.wpshield_hardening_results USING btree (company_id);
CREATE UNIQUE INDEX idx_hardening_company_check ON public.wpshield_hardening_results USING btree (company_id, check_key);
CREATE INDEX idx_snapshot_company_kind_time ON public.wpshield_inventory_snapshots USING btree (company_id, kind, occurred_at DESC);
CREATE INDEX idx_uptime_logs_company ON public.wpshield_uptime_logs USING btree (company_id, checked_at DESC);
CREATE INDEX idx_vuln_alerts_company ON public.wpshield_vuln_alerts USING btree (company_id, created_at DESC);

-- ENABLE RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_blocked_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_events_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_events_attack ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_events_file ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_events_login ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_hardening_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_uptime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wpshield_vuln_alerts ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "Admins can see everything" ON activity_logs
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "activity_insert" ON activity_logs
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "activity_select" ON activity_logs
  AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "Admins can see everything" ON alerts
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "alerts_delete" ON alerts
  AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY "alerts_insert" ON alerts
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "alerts_select" ON alerts
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "alerts_update" ON alerts
  AS PERMISSIVE FOR UPDATE TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "Admin access bypass" ON api_audit_logs
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Service role full access" ON client_invitations
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can see everything" ON companies
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "companies_delete" ON companies
  AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY "companies_insert" ON companies
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "companies_select" ON companies
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "companies_update" ON companies
  AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Admin access bypass" ON customers
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Admin access bypass" ON entitlements
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Admin access bypass" ON invoices
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Admin access bypass" ON licenses
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Admins can manage managed reviews" ON managed_reviews
  AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));
CREATE POLICY "Users can read own managed reviews" ON managed_reviews
  AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.company_id = managed_reviews.company_id) OR (user_profiles.role = 'admin'::text))))));
CREATE POLICY "mfa_codes_delete_own" ON mfa_codes
  AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "mfa_codes_insert_own" ON mfa_codes
  AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "mfa_codes_select_own" ON mfa_codes
  AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "mfa_codes_update_own" ON mfa_codes
  AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "owner_read" ON pending_checkouts
  AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "service_role_all" ON pending_checkouts
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can see everything" ON pending_companies
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "pending_delete" ON pending_companies
  AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY "pending_select" ON pending_companies
  AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "pending_update" ON pending_companies
  AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Admin access bypass" ON plans
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "admin_read" ON plugin_releases
  AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_role_all" ON plugin_releases
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Admins can insert report history" ON report_history
  AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::text)))));
CREATE POLICY "Users can read own report history" ON report_history
  AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.company_id = report_history.company_id) OR (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Users can manage own scheduled reports" ON scheduled_reports
  AS PERMISSIVE FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.company_id = scheduled_reports.company_id) OR (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Users can read own scheduled reports" ON scheduled_reports
  AS PERMISSIVE FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND ((user_profiles.company_id = scheduled_reports.company_id) OR (user_profiles.role = 'admin'::text))))));
CREATE POLICY "Admin access bypass" ON site_tokens
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Admin access bypass" ON sites
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Admin access bypass" ON subscriptions
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Admins can see everything" ON user_profiles
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "profiles_delete" ON user_profiles
  AS PERMISSIVE FOR DELETE TO public USING (is_admin());
CREATE POLICY "profiles_insert" ON user_profiles
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "profiles_select" ON user_profiles
  AS PERMISSIVE FOR SELECT TO public USING (((id = auth.uid()) OR is_admin()));
CREATE POLICY "profiles_select_admin" ON user_profiles
  AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "profiles_select_own" ON user_profiles
  AS PERMISSIVE FOR SELECT TO public USING ((id = auth.uid()));
CREATE POLICY "profiles_update" ON user_profiles
  AS PERMISSIVE FOR UPDATE TO public USING (((id = auth.uid()) OR is_admin()));
CREATE POLICY "profiles_update_admin" ON user_profiles
  AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY "profiles_update_own" ON user_profiles
  AS PERMISSIVE FOR UPDATE TO public USING ((id = auth.uid()));
CREATE POLICY "Admin access bypass" ON webhook_events
  AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "admin_all" ON wpshield_blocked_countries
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "blocked_countries_all" ON wpshield_blocked_countries
  AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY "blocked_countries_select" ON wpshield_blocked_countries
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "client_select_own" ON wpshield_blocked_countries
  AS PERMISSIVE FOR SELECT TO authenticated USING ((company_id = get_user_company_id()));
CREATE POLICY "admin_all" ON wpshield_blocked_ips
  AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "blocked_ips_all" ON wpshield_blocked_ips
  AS PERMISSIVE FOR ALL TO public USING (is_admin());
CREATE POLICY "blocked_ips_select" ON wpshield_blocked_ips
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "activity_insert" ON wpshield_events_activity
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "activity_select" ON wpshield_events_activity
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "admin_all" ON wpshield_events_activity
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "client_select_own" ON wpshield_events_activity
  AS PERMISSIVE FOR SELECT TO authenticated USING ((company_id = get_user_company_id()));
CREATE POLICY "Admins can see everything" ON wpshield_events_attack
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "events_attack_select" ON wpshield_events_attack
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "Admins can see everything" ON wpshield_events_file
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "events_file_select" ON wpshield_events_file
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "Admins can see everything" ON wpshield_events_login
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "events_login_select" ON wpshield_events_login
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "hardening_insert" ON wpshield_hardening_results
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "hardening_select" ON wpshield_hardening_results
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "hardening_update" ON wpshield_hardening_results
  AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Admins can see everything" ON wpshield_inventory_snapshots
  AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "inventory_select" ON wpshield_inventory_snapshots
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "uptime_logs_insert" ON wpshield_uptime_logs
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "uptime_logs_select" ON wpshield_uptime_logs
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));
CREATE POLICY "vuln_alerts_insert" ON wpshield_vuln_alerts
  AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_admin());
CREATE POLICY "vuln_alerts_select" ON wpshield_vuln_alerts
  AS PERMISSIVE FOR SELECT TO public USING ((is_admin() OR (company_id = get_user_company_id())));

-- GRANTS
GRANT ALL ON activity_logs TO service_role;
GRANT ALL ON alerts TO service_role;
GRANT ALL ON api_audit_logs TO service_role;
GRANT ALL ON client_invitations TO service_role;
GRANT ALL ON companies TO service_role;
GRANT ALL ON customers TO service_role;
GRANT ALL ON entitlements TO service_role;
GRANT ALL ON invoices TO service_role;
GRANT ALL ON licenses TO service_role;
GRANT ALL ON managed_reviews TO service_role;
GRANT ALL ON mfa_codes TO service_role;
GRANT ALL ON pending_checkouts TO service_role;
GRANT ALL ON pending_companies TO service_role;
GRANT ALL ON plans TO service_role;
GRANT ALL ON plugin_releases TO service_role;
GRANT ALL ON report_history TO service_role;
GRANT ALL ON scheduled_reports TO service_role;
GRANT ALL ON site_tokens TO service_role;
GRANT ALL ON sites TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON webhook_events TO service_role;
GRANT ALL ON wpshield_blocked_countries TO service_role;
GRANT ALL ON wpshield_blocked_ips TO service_role;
GRANT ALL ON wpshield_events_activity TO service_role;
GRANT ALL ON wpshield_events_attack TO service_role;
GRANT ALL ON wpshield_events_file TO service_role;
GRANT ALL ON wpshield_events_login TO service_role;
GRANT ALL ON wpshield_hardening_results TO service_role;
GRANT ALL ON wpshield_inventory_snapshots TO service_role;
GRANT ALL ON wpshield_uptime_logs TO service_role;
GRANT ALL ON wpshield_vuln_alerts TO service_role;

-- Revoke broad anon access from sensitive tables
REVOKE ALL ON report_history FROM anon;
REVOKE ALL ON scheduled_reports FROM anon;
REVOKE ALL ON managed_reviews FROM anon;
REVOKE ALL ON customers FROM anon;
REVOKE ALL ON subscriptions FROM anon;
REVOKE ALL ON licenses FROM anon;
REVOKE ALL ON invoices FROM anon;
REVOKE ALL ON site_tokens FROM anon;
REVOKE ALL ON mfa_codes FROM anon;
REVOKE ALL ON pending_checkouts FROM anon;

-- SEED: plans
INSERT INTO plans (id, price_id, name, created_at, price, max_sites, plan_family, price_usd, price_inr_test) VALUES ('starter', 'price_starter_paynimo', 'Starter', '2026-06-13 16:34:09.083729+00:00', '10', 1, 'solo', '10.00', 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO plans (id, price_id, name, created_at, price, max_sites, plan_family, price_usd, price_inr_test) VALUES ('growth', 'price_growth_paynimo', 'Growth', '2026-06-13 16:34:09.083729+00:00', '30', 5, 'growth', '30.00', 5) ON CONFLICT (id) DO NOTHING;