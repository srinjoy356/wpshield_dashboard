-- =============================================================================
-- WPShield — Complete Plans Setup
-- Run this in Supabase SQL Editor
-- =============================================================================
-- Plans:
--   core    — Free, 1 site, limited features
--   solo    — ₹2,999/year, 1 site, full cloud features
--   growth  — ₹11,999/year, 5 sites, multi-site dashboard
--   agency  — ₹49,999/year, 25 sites, white-label reports
--   managed_review — ₹1,499/month/site add-on
-- =============================================================================

-- ── Step 1: Ensure plans table has all needed columns ─────────────────────────

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_inr_live    numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_usd_live    numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_inr_test    numeric(10,2),
  ADD COLUMN IF NOT EXISTS billing_interval  text DEFAULT 'yearly'
                           CHECK (billing_interval IN ('monthly','yearly','one_time','free')),
  ADD COLUMN IF NOT EXISTS max_sites         integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plan_family       text,
  ADD COLUMN IF NOT EXISTS currency          text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS region            text DEFAULT 'india',
  ADD COLUMN IF NOT EXISTS tax_code          text,
  ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true,
  -- Feature flags — what each plan unlocks
  ADD COLUMN IF NOT EXISTS feature_cloud_dashboard      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_email_alerts         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_slack_alerts         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_file_integrity_full  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_activity_logs_full   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_ip_blocking          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_geo_blocking         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_away_mode            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_maintenance_mode     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_pdf_reports          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_whitelabel_reports   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_multisite_dashboard  boolean NOT NULL DEFAULT false;

-- ── Step 2: Upsert all 5 plans ───────────────────────────────────────────────
-- Uses ON CONFLICT (id) so re-running this is safe — it updates, never duplicates.

INSERT INTO public.plans (
  id, name, plan_family, billing_interval,
  price_inr_test, price_inr_live, price_usd_live,
  currency, region, max_sites, is_active,
  -- Feature flags
  feature_cloud_dashboard,
  feature_email_alerts,
  feature_slack_alerts,
  feature_file_integrity_full,
  feature_activity_logs_full,
  feature_ip_blocking,
  feature_geo_blocking,
  feature_away_mode,
  feature_maintenance_mode,
  feature_pdf_reports,
  feature_whitelabel_reports,
  feature_multisite_dashboard
)
VALUES

-- ── CORE (Free) ──────────────────────────────────────────────────────────────
-- Basic attack logs, login logs, plugin/theme inventory, XML-RPC disable,
-- maintenance mode. No cloud dashboard, no alerts, limited file/activity.
(
  'core', 'Core', 'core', 'free',
  0, 0, 0,
  'INR', 'global', 1, true,
  false, -- cloud_dashboard
  false, -- email_alerts
  false, -- slack_alerts
  false, -- file_integrity_full (limited)
  false, -- activity_logs_full (limited)
  false, -- ip_blocking
  false, -- geo_blocking
  false, -- away_mode
  true,  -- maintenance_mode (yes per feature table)
  false, -- pdf_reports
  false, -- whitelabel_reports
  false  -- multisite_dashboard
),

-- ── SOLO (₹2,999/year — Paid/Cloud, 1 site) ──────────────────────────────────
-- Everything Core has + cloud dashboard, real-time email alerts, Slack alerts,
-- full file integrity, full activity logs, manual IP blocking, auto IP blocking,
-- geo blocking, away mode, maintenance mode, PDF reports. No white-label. No multi-site.
(
  'solo', 'Solo', 'solo', 'yearly',
  1, 2999, 49,
  'INR', 'india', 1, true,
  true,  -- cloud_dashboard
  true,  -- email_alerts
  true,  -- slack_alerts
  true,  -- file_integrity_full
  true,  -- activity_logs_full
  true,  -- ip_blocking
  true,  -- geo_blocking
  true,  -- away_mode
  true,  -- maintenance_mode
  true,  -- pdf_reports
  false, -- whitelabel_reports
  false  -- multisite_dashboard
),

-- ── GROWTH (₹11,999/year — Paid/Cloud, 5 sites) ──────────────────────────────
-- Everything Solo has + multi-site dashboard (limited per feature table).
(
  'growth', 'Growth', 'growth', 'yearly',
  2, 11999, 199,
  'INR', 'india', 5, true,
  true,  -- cloud_dashboard
  true,  -- email_alerts
  true,  -- slack_alerts
  true,  -- file_integrity_full
  true,  -- activity_logs_full
  true,  -- ip_blocking
  true,  -- geo_blocking
  true,  -- away_mode
  true,  -- maintenance_mode
  true,  -- pdf_reports
  false, -- whitelabel_reports
  true   -- multisite_dashboard (limited)
),

-- ── AGENCY (₹49,999/year — Agency, 25 sites) ─────────────────────────────────
-- Everything Growth has + white-label reports + full multi-site dashboard.
(
  'agency', 'Agency', 'agency', 'yearly',
  3, 49999, 999,
  'INR', 'india', 25, true,
  true,  -- cloud_dashboard
  true,  -- email_alerts
  true,  -- slack_alerts
  true,  -- file_integrity_full
  true,  -- activity_logs_full
  true,  -- ip_blocking
  true,  -- geo_blocking
  true,  -- away_mode
  true,  -- maintenance_mode
  true,  -- pdf_reports
  true,  -- whitelabel_reports
  true   -- multisite_dashboard (full)
),

-- ── MANAGED REVIEW ADD-ON (₹1,499/month/site) ────────────────────────────────
-- Not a standalone subscription — purchased on top of an existing plan.
-- Handled via customer_addons, not subscriptions. Included here for catalog
-- completeness and so it shows on the billing page.
(
  'managed_review', 'Managed Review Add-on', 'addon', 'monthly',
  4, 1499, 19,
  'INR', 'india', 1, true,
  false, false, false, false, false,
  false, false, false, false, false,
  false, false
)

ON CONFLICT (id) DO UPDATE SET
  name                          = EXCLUDED.name,
  plan_family                   = EXCLUDED.plan_family,
  billing_interval              = EXCLUDED.billing_interval,
  price_inr_test                = EXCLUDED.price_inr_test,
  price_inr_live                = EXCLUDED.price_inr_live,
  price_usd_live                = EXCLUDED.price_usd_live,
  currency                      = EXCLUDED.currency,
  region                        = EXCLUDED.region,
  max_sites                     = EXCLUDED.max_sites,
  is_active                     = EXCLUDED.is_active,
  feature_cloud_dashboard       = EXCLUDED.feature_cloud_dashboard,
  feature_email_alerts          = EXCLUDED.feature_email_alerts,
  feature_slack_alerts          = EXCLUDED.feature_slack_alerts,
  feature_file_integrity_full   = EXCLUDED.feature_file_integrity_full,
  feature_activity_logs_full    = EXCLUDED.feature_activity_logs_full,
  feature_ip_blocking           = EXCLUDED.feature_ip_blocking,
  feature_geo_blocking          = EXCLUDED.feature_geo_blocking,
  feature_away_mode             = EXCLUDED.feature_away_mode,
  feature_maintenance_mode      = EXCLUDED.feature_maintenance_mode,
  feature_pdf_reports           = EXCLUDED.feature_pdf_reports,
  feature_whitelabel_reports    = EXCLUDED.feature_whitelabel_reports,
  feature_multisite_dashboard   = EXCLUDED.feature_multisite_dashboard;

-- ── Step 3: Verify ───────────────────────────────────────────────────────────

SELECT
  id,
  name,
  plan_family,
  billing_interval,
  max_sites,
  price_inr_test   AS "test_₹",
  price_inr_live   AS "live_₹",
  price_usd_live   AS "live_$",
  feature_cloud_dashboard      AS cloud,
  feature_email_alerts         AS email,
  feature_whitelabel_reports   AS whitelabel,
  feature_multisite_dashboard  AS multisite,
  is_active
FROM plans
ORDER BY price_inr_live ASC NULLS FIRST;