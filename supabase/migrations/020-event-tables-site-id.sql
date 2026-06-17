-- Adds a verified site_id alongside the existing site_url on every event-level table.
-- site_url is a raw, self-reported string from the WordPress plugin's payload — fine
-- for display, but not reliable to query/group by (http vs https, www vs not, a site
-- renaming its domain). site_id is the verified value already available from the
-- site token at ingest time (see verifySiteToken in lib/security/guards.ts) and is
-- what the hardening-audit and vuln-check rewrites query against going forward.
--
-- Nullable for the same reason as migration 019: existing rows predate this column.

ALTER TABLE public.wpshield_events_attack
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_events_attack_site_id ON public.wpshield_events_attack (site_id);

ALTER TABLE public.wpshield_events_file
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_events_file_site_id ON public.wpshield_events_file (site_id);

ALTER TABLE public.wpshield_events_activity
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_events_activity_site_id ON public.wpshield_events_activity (site_id);

ALTER TABLE public.wpshield_events_login
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_events_login_site_id ON public.wpshield_events_login (site_id);

ALTER TABLE public.wpshield_inventory_snapshots
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_site_id ON public.wpshield_inventory_snapshots (site_id);

ALTER TABLE public.wpshield_uptime_logs
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_uptime_logs_site_id ON public.wpshield_uptime_logs (site_id);