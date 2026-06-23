-- 027_fix_plans_active_column.sql
--
-- The RLS policy on plans (migration 016) uses:
--   USING (active = true)
--
-- The setup_plans.py upsert only set 'is_active' (a new column added for
-- internal use) but never set the original 'active' column that RLS checks.
--
-- Impact: get-plan-features() uses a user-scoped Supabase client which is
-- subject to RLS. With active = NULL on new plan rows, RLS filters them out,
-- so the feature query returns nothing and every user falls back to Core
-- (free) features even after a paid subscription — premium features never
-- activate on the dashboard.
--
-- Fix: ensure active = true on every plan row, then keep them in sync.

UPDATE public.plans
SET active = true
WHERE active IS NULL OR active = false;

-- For any future upserts, a trigger keeps active and is_active in sync
-- so this class of bug cannot silently reappear.
CREATE OR REPLACE FUNCTION public.sync_plan_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Keep the legacy 'active' column (used by RLS) in sync with 'is_active'
  NEW.active := COALESCE(NEW.is_active, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_plan_active ON public.plans;
CREATE TRIGGER trg_sync_plan_active
  BEFORE INSERT OR UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.sync_plan_active();

-- Verify
SELECT id, name, active, is_active
FROM public.plans
ORDER BY price_inr_live ASC NULLS FIRST;