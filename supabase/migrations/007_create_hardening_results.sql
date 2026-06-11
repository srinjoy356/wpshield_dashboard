-- ====================================================================
-- WPShield — Create wpshield_hardening_results table
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.wpshield_hardening_results (
  id              bigserial    PRIMARY KEY,
  company_id      text         NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
  check_key       text         NOT NULL,
  check_name      text         NOT NULL,
  category        text         NOT NULL,
  status          text         NOT NULL DEFAULT 'unknown' CHECK (status IN ('pass', 'fail', 'unknown')),
  priority        text         NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  description     text,
  recommendation  text,
  score_impact    integer      NOT NULL,
  last_checked_at timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (company_id, check_key)
);

COMMENT ON TABLE public.wpshield_hardening_results IS 'WPShield hardening audit check results';

-- Enable Row Level Security
ALTER TABLE public.wpshield_hardening_results ENABLE ROW LEVEL SECURITY;

-- Select policy: Admins or clients of the same company
DROP POLICY IF EXISTS "hardening_results_select" ON public.wpshield_hardening_results;
CREATE POLICY "hardening_results_select" ON public.wpshield_hardening_results
  FOR SELECT USING (is_admin() OR company_id = get_user_company_id());

-- Modify policies: Admins only
DROP POLICY IF EXISTS "hardening_results_insert" ON public.wpshield_hardening_results;
CREATE POLICY "hardening_results_insert" ON public.wpshield_hardening_results
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "hardening_results_update" ON public.wpshield_hardening_results;
CREATE POLICY "hardening_results_update" ON public.wpshield_hardening_results
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "hardening_results_delete" ON public.wpshield_hardening_results;
CREATE POLICY "hardening_results_delete" ON public.wpshield_hardening_results
  FOR DELETE USING (is_admin());

-- Permissions
GRANT ALL ON public.wpshield_hardening_results TO service_role;
GRANT SELECT ON public.wpshield_hardening_results TO authenticated;
