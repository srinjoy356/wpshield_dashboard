-- Adds site-level attribution to alerts, hardening results, and vulnerability alerts.
-- All three currently only carry company_id, a holdover from before this app supported
-- more than one site per license (growth plan = up to 5 sites). For a company with
-- multiple active sites, there is currently no way to tell which specific site an
-- alert, hardening finding, or vulnerability came from.
--
-- Nullable, not NOT NULL: existing rows predate this column and have no reliable way
-- to backfill it (alerts in particular only reference source_table/source_event_id,
-- and not every one of those source events itself carries a site_id either — see
-- migration 020). Existing rows stay NULL ("company-wide / unattributed, predates
-- per-site tracking"); every write path going forward is updated to populate it.

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_alerts_site_id ON public.alerts (site_id);

ALTER TABLE public.wpshield_hardening_results
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_hardening_results_site_id ON public.wpshield_hardening_results (site_id);

ALTER TABLE public.wpshield_vuln_alerts
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);
CREATE INDEX IF NOT EXISTS idx_vuln_alerts_site_id ON public.wpshield_vuln_alerts (site_id);