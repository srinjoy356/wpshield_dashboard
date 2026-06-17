-- Moves per-site monitoring state off the single-site-per-company `companies` row and
-- onto `sites`, where it actually belongs now that one company can have several active
-- sites. companies.uptime_status etc. are left in place (still read by older code paths
-- until those are migrated) but are no longer the source of truth going forward.

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS uptime_status        text,
  ADD COLUMN IF NOT EXISTS uptime_response_ms    integer,
  ADD COLUMN IF NOT EXISTS last_uptime_check     timestamptz,
  ADD COLUMN IF NOT EXISTS safebrowsing_status   text,
  ADD COLUMN IF NOT EXISTS last_safebrowsing_check timestamptz;

-- hardening_results was unique on (company_id, check_key) — fine when one company meant
-- one site. Now that checks run per-site, the same check_key needs to be able to exist
-- once per site within a company. Existing legacy rows (site_id IS NULL) are untouched;
-- NULL is never considered equal to NULL for uniqueness purposes in Postgres, so they
-- won't conflict with new per-site rows or each other.
ALTER TABLE public.wpshield_hardening_results
  DROP CONSTRAINT IF EXISTS idx_hardening_company_check;
DROP INDEX IF EXISTS idx_hardening_company_check;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hardening_results_company_site_check
  ON public.wpshield_hardening_results (company_id, site_id, check_key);