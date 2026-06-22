-- 025_persite_site_controls.sql
--
-- Adds per-site overrides for maintenance_mode and away_mode_schedule.
-- Previously both lived on `companies` and applied uniformly to every site
-- belonging to that company. Now each site can independently override them.
--
-- site_controls_enabled = true  → use this site's own values (ignore company-level)
-- site_controls_enabled = false → inherit company-level settings (default, backward compatible)
--
-- Also adds explicit status values for pending_checkouts.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS maintenance_mode      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS away_mode_schedule    jsonb,
  ADD COLUMN IF NOT EXISTS site_controls_enabled boolean     NOT NULL DEFAULT false;

-- Explicit status constraint for pending_checkouts
ALTER TABLE public.pending_checkouts
  DROP CONSTRAINT IF EXISTS pending_checkouts_status_check;

ALTER TABLE public.pending_checkouts
  ADD CONSTRAINT pending_checkouts_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'expired',
    'amount_mismatch',
    'needs_review',
    'needs_manual_provisioning'
  ));

-- Grants
GRANT ALL ON public.sites TO service_role;
GRANT ALL ON public.pending_checkouts TO service_role;