-- ====================================================================
-- WPShield — Create wpshield_global_settings table for admin settings
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.wpshield_global_settings (
  key   text         PRIMARY KEY,
  value jsonb        NOT NULL
);

COMMENT ON TABLE public.wpshield_global_settings IS 'WPShield global administrative configurations';

-- Enable Row Level Security
ALTER TABLE public.wpshield_global_settings ENABLE ROW LEVEL SECURITY;

-- Select policy: Admins only
DROP POLICY IF EXISTS "global_settings_select" ON public.wpshield_global_settings;
CREATE POLICY "global_settings_select" ON public.wpshield_global_settings
  FOR SELECT USING (is_admin());

-- Modify policies: Admins only
DROP POLICY IF EXISTS "global_settings_insert" ON public.wpshield_global_settings;
CREATE POLICY "global_settings_insert" ON public.wpshield_global_settings
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "global_settings_update" ON public.wpshield_global_settings;
CREATE POLICY "global_settings_update" ON public.wpshield_global_settings
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "global_settings_delete" ON public.wpshield_global_settings;
CREATE POLICY "global_settings_delete" ON public.wpshield_global_settings
  FOR DELETE USING (is_admin());

-- Permissions
GRANT ALL ON public.wpshield_global_settings TO service_role;
GRANT SELECT ON public.wpshield_global_settings TO authenticated;
