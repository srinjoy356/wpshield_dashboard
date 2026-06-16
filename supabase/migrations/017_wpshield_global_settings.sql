-- wpshield_global_settings: backs the admin Settings -> SMTP config screen
-- (app/admin/settings/actions.ts). This table never existed on the live database —
-- found during a full codebase-vs-schema validation pass, not part of the original
-- 17-gap report. Every read/write to it was failing silently (caught and returned as
-- a JSON error), so the feature has never actually worked.

CREATE TABLE IF NOT EXISTS public.wpshield_global_settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.wpshield_global_settings IS 'Singleton-style key/value config store, e.g. key=''smtp_config''. Admin-only, read and written exclusively through the service_role-backed server actions in app/admin/settings/actions.ts.';

ALTER TABLE public.wpshield_global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wpshield_global_settings_service_role" ON public.wpshield_global_settings;
CREATE POLICY "wpshield_global_settings_service_role" ON public.wpshield_global_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.wpshield_global_settings TO service_role;
REVOKE ALL ON public.wpshield_global_settings FROM anon;