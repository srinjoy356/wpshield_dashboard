-- ═══════════════════════════════════════════════════════════════════
-- Cybernara WPShield — Phase 1 Foundation Migration
-- ═══════════════════════════════════════════════════════════════════
-- This migration is idempotent: safe to re-run.
-- It creates all new tables, indexes, helper functions, triggers,
-- and Row Level Security policies needed for the dashboard.
-- ═══════════════════════════════════════════════════════════════════

-- =============================================
-- A. CREATE NEW TABLES
-- =============================================

-- 1. companies — each onboarded WPShield client
CREATE TABLE IF NOT EXISTS public.companies (
  id           bigserial    PRIMARY KEY,
  company_id   text         UNIQUE NOT NULL,
  display_name text         NOT NULL,
  contact_email text,
  status       text         NOT NULL DEFAULT 'active',
  onboarded_at timestamptz  NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  notes        text
);
COMMENT ON TABLE public.companies IS 'Onboarded WPShield client companies';

-- 2. pending_companies — sites sending data but not yet onboarded
CREATE TABLE IF NOT EXISTS public.pending_companies (
  id            bigserial    PRIMARY KEY,
  company_id    text         UNIQUE NOT NULL,
  site_url      text,
  first_seen_at timestamptz  NOT NULL DEFAULT now(),
  last_seen_at  timestamptz  NOT NULL DEFAULT now(),
  event_count   integer      NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.pending_companies IS 'Sites detected by plugin but not yet onboarded';

-- 3. user_profiles — dashboard user accounts linked to auth.users
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id   text         REFERENCES public.companies(company_id),
  role         text         NOT NULL DEFAULT 'client',
  display_name text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.user_profiles IS 'Dashboard user profiles (admin or client)';

-- 4. alerts — security alerts generated from events
CREATE TABLE IF NOT EXISTS public.alerts (
  id              bigserial    PRIMARY KEY,
  company_id      text         NOT NULL,
  source_table    text,
  source_event_id bigint,
  severity        text,
  title           text         NOT NULL,
  description     text,
  status          text         NOT NULL DEFAULT 'open',
  acknowledged_by uuid         REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.alerts IS 'Security alerts tied to client companies';

-- 5. activity_logs — admin audit trail
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id                bigserial    PRIMARY KEY,
  actor_id          uuid         REFERENCES auth.users(id),
  action            text         NOT NULL,
  target_company_id text,
  metadata          jsonb,
  created_at        timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.activity_logs IS 'Audit trail of admin actions';


-- =============================================
-- B. INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_companies_company_id
  ON public.companies (company_id);

CREATE INDEX IF NOT EXISTS idx_pending_companies_company_id
  ON public.pending_companies (company_id);

CREATE INDEX IF NOT EXISTS idx_pending_companies_last_seen
  ON public.pending_companies (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id
  ON public.user_profiles (company_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role
  ON public.user_profiles (role);

CREATE INDEX IF NOT EXISTS idx_alerts_company_created
  ON public.alerts (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_status
  ON public.alerts (status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created
  ON public.activity_logs (actor_id, created_at DESC);


-- =============================================
-- C. HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- get_user_company_id: returns the company_id for the current user
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT company_id
    FROM public.user_profiles
    WHERE id = auth.uid()
  );
END;
$$;
COMMENT ON FUNCTION public.get_user_company_id IS 'Returns company_id for the authenticated user';

-- is_admin: returns true if the current user has role=admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$$;
COMMENT ON FUNCTION public.is_admin IS 'Returns true if authenticated user is an admin';


-- =============================================
-- D. AUTO-DETECTION TRIGGER
-- =============================================
-- When a new event arrives, check if the company_id already exists
-- in `companies`. If not, upsert into `pending_companies`.
-- If yes, update `companies.last_seen_at`.

CREATE OR REPLACE FUNCTION public.detect_pending_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if company already exists as onboarded
  IF EXISTS (SELECT 1 FROM public.companies WHERE company_id = NEW.company_id) THEN
    -- Update last_seen_at for existing company
    UPDATE public.companies
    SET last_seen_at = now()
    WHERE company_id = NEW.company_id;
  ELSE
    -- Upsert into pending_companies
    INSERT INTO public.pending_companies (company_id, site_url, first_seen_at, last_seen_at, event_count)
    VALUES (NEW.company_id, NEW.site_url, now(), now(), 1)
    ON CONFLICT (company_id) DO UPDATE
    SET event_count  = pending_companies.event_count + 1,
        last_seen_at = now(),
        site_url     = COALESCE(NULLIF(NEW.site_url, ''), pending_companies.site_url);
  END IF;

  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.detect_pending_company IS 'Auto-detect new companies from incoming plugin events';

-- Attach trigger to all 4 existing event tables
-- Drop existing triggers first to ensure idempotency

DROP TRIGGER IF EXISTS trg_detect_pending_attack ON public.wpshield_events_attack;
CREATE TRIGGER trg_detect_pending_attack
  AFTER INSERT ON public.wpshield_events_attack
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_pending_company();

DROP TRIGGER IF EXISTS trg_detect_pending_login ON public.wpshield_events_login;
CREATE TRIGGER trg_detect_pending_login
  AFTER INSERT ON public.wpshield_events_login
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_pending_company();

DROP TRIGGER IF EXISTS trg_detect_pending_file ON public.wpshield_events_file;
CREATE TRIGGER trg_detect_pending_file
  AFTER INSERT ON public.wpshield_events_file
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_pending_company();

DROP TRIGGER IF EXISTS trg_detect_pending_inventory ON public.wpshield_inventory_snapshots;
CREATE TRIGGER trg_detect_pending_inventory
  AFTER INSERT ON public.wpshield_inventory_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_pending_company();


-- =============================================
-- E. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_companies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wpshield_events_attack       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wpshield_events_login        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wpshield_events_file         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wpshield_inventory_snapshots ENABLE ROW LEVEL SECURITY;

-- ── wpshield_events_attack ──
DROP POLICY IF EXISTS "events_attack_select" ON public.wpshield_events_attack;
CREATE POLICY "events_attack_select" ON public.wpshield_events_attack
  FOR SELECT USING (is_admin() OR company_id = get_user_company_id());

-- ── wpshield_events_login ──
DROP POLICY IF EXISTS "events_login_select" ON public.wpshield_events_login;
CREATE POLICY "events_login_select" ON public.wpshield_events_login
  FOR SELECT USING (is_admin() OR company_id = get_user_company_id());

-- ── wpshield_events_file ──
DROP POLICY IF EXISTS "events_file_select" ON public.wpshield_events_file;
CREATE POLICY "events_file_select" ON public.wpshield_events_file
  FOR SELECT USING (is_admin() OR company_id = get_user_company_id());

-- ── wpshield_inventory_snapshots ──
DROP POLICY IF EXISTS "inventory_select" ON public.wpshield_inventory_snapshots;
CREATE POLICY "inventory_select" ON public.wpshield_inventory_snapshots
  FOR SELECT USING (is_admin() OR company_id = get_user_company_id());

-- ── companies ──
DROP POLICY IF EXISTS "companies_select" ON public.companies;
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT USING (is_admin() OR company_id = get_user_company_id());

DROP POLICY IF EXISTS "companies_insert" ON public.companies;
CREATE POLICY "companies_insert" ON public.companies
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "companies_update" ON public.companies;
CREATE POLICY "companies_update" ON public.companies
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "companies_delete" ON public.companies;
CREATE POLICY "companies_delete" ON public.companies
  FOR DELETE USING (is_admin());

-- ── pending_companies ──
DROP POLICY IF EXISTS "pending_select" ON public.pending_companies;
CREATE POLICY "pending_select" ON public.pending_companies
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "pending_update" ON public.pending_companies;
CREATE POLICY "pending_update" ON public.pending_companies
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "pending_delete" ON public.pending_companies;
CREATE POLICY "pending_delete" ON public.pending_companies
  FOR DELETE USING (is_admin());

-- ── user_profiles ──
DROP POLICY IF EXISTS "profiles_select" ON public.user_profiles;
CREATE POLICY "profiles_select" ON public.user_profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_update" ON public.user_profiles;
CREATE POLICY "profiles_update" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_insert" ON public.user_profiles;
CREATE POLICY "profiles_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "profiles_delete" ON public.user_profiles;
CREATE POLICY "profiles_delete" ON public.user_profiles
  FOR DELETE USING (is_admin());

-- ── alerts ──
DROP POLICY IF EXISTS "alerts_select" ON public.alerts;
CREATE POLICY "alerts_select" ON public.alerts
  FOR SELECT USING (is_admin() OR company_id = get_user_company_id());

DROP POLICY IF EXISTS "alerts_update" ON public.alerts;
CREATE POLICY "alerts_update" ON public.alerts
  FOR UPDATE USING (is_admin() OR company_id = get_user_company_id());

DROP POLICY IF EXISTS "alerts_insert" ON public.alerts;
CREATE POLICY "alerts_insert" ON public.alerts
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "alerts_delete" ON public.alerts;
CREATE POLICY "alerts_delete" ON public.alerts
  FOR DELETE USING (is_admin());

-- ── activity_logs ──
DROP POLICY IF EXISTS "activity_select" ON public.activity_logs;
CREATE POLICY "activity_select" ON public.activity_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "activity_insert" ON public.activity_logs;
CREATE POLICY "activity_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (is_admin());


-- =============================================
-- F. NO SEED DATA
-- =============================================
-- Clients will be auto-detected from the WordPress plugin.
-- No seed data is needed.

-- ═══════════════════════════════════════════════════════════════════
-- Migration complete.
-- ═══════════════════════════════════════════════════════════════════
