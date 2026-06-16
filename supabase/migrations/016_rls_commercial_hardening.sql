-- RLS for the commercial tables introduced in migrations 010-015.
-- Default posture: service_role (used by all server-side API routes via
-- lib/supabase/admin.ts) gets full access; authenticated users only ever see rows that
-- belong to them; anon gets nothing except the public plan catalog.
--
-- Every CREATE POLICY below is preceded by a DROP POLICY IF EXISTS for BOTH its own name
-- and every ORIGINAL policy name found on your live database (per wpshield_full_schema.sql,
-- confirmed against an actual schema export). This matters for two separate reasons:
--   1. Postgres has no "CREATE POLICY IF NOT EXISTS" — re-running this file without the
--      drops fails outright on "policy already exists".
--   2. Multiple permissive RLS policies on the same table are combined with OR. If an old,
--      looser policy is left in place under a different name than the new one, the new
--      tighter policy doesn't actually restrict anything — the old one still grants access
--      in parallel. Several of the original policies (customers_owner_write,
--      customers_admin_all, entitlements_read, invoices_admin_all, licenses_owner_read,
--      licenses_admin_all, plus the generically-named "service_role_all"/"owner_read"/
--      "admin_read" on pending_checkouts and plugin_releases) would otherwise survive
--      this migration completely untouched and silently keep the old, broader access alive.

ALTER TABLE public.customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_checkouts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_tokens        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plugin_releases    ENABLE ROW LEVEL SECURITY;

-- ── plans ──
-- G-14: this table had "FOR ALL TO public USING (true)" — anonymous, unauthenticated
-- requests could insert, update, or delete pricing rows. Prices are fine to read
-- publicly; writing them is not.
DROP POLICY IF EXISTS "Admin access bypass" ON public.plans;
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
DROP POLICY IF EXISTS "Service role manages plans" ON public.plans;
CREATE POLICY "Plans are publicly readable" ON public.plans FOR SELECT USING (active = true);
CREATE POLICY "Service role manages plans"  ON public.plans FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── customers ──
-- Dropping customers_owner_write and customers_admin_all: a customer could previously
-- write their own row directly, and an admin session could bypass straight through RLS.
-- Both now go through service_role-only backend routes instead.
DROP POLICY IF EXISTS "customers_service_role" ON public.customers;
DROP POLICY IF EXISTS "customers_owner_read" ON public.customers;
DROP POLICY IF EXISTS "customers_owner_write" ON public.customers;
DROP POLICY IF EXISTS "customers_admin_all" ON public.customers;
CREATE POLICY "customers_service_role" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "customers_owner_read"   ON public.customers FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

-- ── entitlements ── (no direct client access — read via service role joins only)
-- Dropping entitlements_read: it was USING (true) for any authenticated user, i.e.
-- every logged-in customer could read every plan's entitlements, not just their own.
DROP POLICY IF EXISTS "entitlements_service_role" ON public.entitlements;
DROP POLICY IF EXISTS "entitlements_read" ON public.entitlements;
CREATE POLICY "entitlements_service_role" ON public.entitlements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── pending_checkouts ──
-- Original policy names here were the generic "service_role_all"/"owner_read" (not
-- prefixed with the table name) — dropping those exact names, not just my new ones.
DROP POLICY IF EXISTS "pending_checkouts_service_role" ON public.pending_checkouts;
DROP POLICY IF EXISTS "pending_checkouts_owner_read" ON public.pending_checkouts;
DROP POLICY IF EXISTS "service_role_all" ON public.pending_checkouts;
DROP POLICY IF EXISTS "owner_read" ON public.pending_checkouts;
CREATE POLICY "pending_checkouts_service_role" ON public.pending_checkouts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "pending_checkouts_owner_read"   ON public.pending_checkouts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── webhook_events ── (service role only — internal reconciliation log)
DROP POLICY IF EXISTS "webhook_events_service_role" ON public.webhook_events;
CREATE POLICY "webhook_events_service_role" ON public.webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── subscriptions ── (names match the originals exactly — re-created identically)
DROP POLICY IF EXISTS "subscriptions_service_role" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_owner_read" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_all" ON public.subscriptions;
CREATE POLICY "subscriptions_service_role" ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "subscriptions_owner_read"   ON public.subscriptions FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE owner_user_id = auth.uid()));
CREATE POLICY "subscriptions_admin_all"    ON public.subscriptions FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── invoices ──
-- Dropping invoices_admin_all: admins no longer get table-level ALL access via RLS,
-- only through service_role-backed routes.
DROP POLICY IF EXISTS "invoices_service_role" ON public.invoices;
DROP POLICY IF EXISTS "invoices_owner_read" ON public.invoices;
DROP POLICY IF EXISTS "invoices_admin_all" ON public.invoices;
CREATE POLICY "invoices_service_role" ON public.invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "invoices_owner_read"   ON public.invoices FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE owner_user_id = auth.uid()));

-- ── licenses ──
-- Dropping licenses_owner_read and licenses_admin_all: license rows (even just status/
-- key_hash) now only go through service_role. Any UI that reads licenses directly via
-- the session client (e.g. a billing page showing license status) must use the admin
-- client instead — see app/app/billing/page.tsx, already updated for this.
DROP POLICY IF EXISTS "licenses_service_role" ON public.licenses;
DROP POLICY IF EXISTS "licenses_owner_read" ON public.licenses;
DROP POLICY IF EXISTS "licenses_admin_all" ON public.licenses;
CREATE POLICY "licenses_service_role" ON public.licenses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── sites ── (names match the originals exactly — re-created identically)
DROP POLICY IF EXISTS "sites_service_role" ON public.sites;
DROP POLICY IF EXISTS "sites_owner_read" ON public.sites;
DROP POLICY IF EXISTS "sites_admin_all" ON public.sites;
CREATE POLICY "sites_service_role" ON public.sites FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sites_owner_read"   ON public.sites FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY "sites_admin_all"    ON public.sites FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── site_tokens ── (raw token hashes — service role only, never exposed to any client)
DROP POLICY IF EXISTS "site_tokens_service_role" ON public.site_tokens;
CREATE POLICY "site_tokens_service_role" ON public.site_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── mfa_codes ── (hashed OTPs — service role only now)
-- Dropping the four "_own" policies: a logged-in user could previously SELECT/INSERT/
-- UPDATE/DELETE their own row directly. Now only service_role touches this table —
-- both send-2fa and verify-2fa already only use the admin client.
DROP POLICY IF EXISTS "mfa_codes_delete_own" ON public.mfa_codes;
DROP POLICY IF EXISTS "mfa_codes_insert_own" ON public.mfa_codes;
DROP POLICY IF EXISTS "mfa_codes_select_own" ON public.mfa_codes;
DROP POLICY IF EXISTS "mfa_codes_update_own" ON public.mfa_codes;
DROP POLICY IF EXISTS "mfa_codes_service_role" ON public.mfa_codes;
CREATE POLICY "mfa_codes_service_role" ON public.mfa_codes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── plugin_releases ──
-- Original names here were also generic ("service_role_all"/"admin_read"), and
-- "admin_read" was USING (true) for any authenticated user — meaning every paying
-- customer, not just admins, could read release storage paths and signatures directly.
DROP POLICY IF EXISTS "plugin_releases_service_role" ON public.plugin_releases;
DROP POLICY IF EXISTS "plugin_releases_admin_read" ON public.plugin_releases;
DROP POLICY IF EXISTS "service_role_all" ON public.plugin_releases;
DROP POLICY IF EXISTS "admin_read" ON public.plugin_releases;
CREATE POLICY "plugin_releases_service_role" ON public.plugin_releases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "plugin_releases_admin_read"   ON public.plugin_releases FOR SELECT TO authenticated USING (is_admin());

-- ── GRANTS ──
GRANT ALL ON public.customers         TO service_role;
GRANT ALL ON public.entitlements      TO service_role;
GRANT ALL ON public.plans             TO service_role;
GRANT ALL ON public.pending_checkouts TO service_role;
GRANT ALL ON public.webhook_events    TO service_role;
GRANT ALL ON public.subscriptions     TO service_role;
GRANT ALL ON public.invoices          TO service_role;
GRANT ALL ON public.licenses          TO service_role;
GRANT ALL ON public.sites             TO service_role;
GRANT ALL ON public.site_tokens       TO service_role;
GRANT ALL ON public.mfa_codes         TO service_role;
GRANT ALL ON public.plugin_releases   TO service_role;

REVOKE ALL ON public.customers         FROM anon;
REVOKE ALL ON public.subscriptions     FROM anon;
REVOKE ALL ON public.licenses          FROM anon;
REVOKE ALL ON public.invoices          FROM anon;
REVOKE ALL ON public.site_tokens       FROM anon;
REVOKE ALL ON public.mfa_codes         FROM anon;
REVOKE ALL ON public.pending_checkouts FROM anon;
REVOKE ALL ON public.webhook_events    FROM anon;
REVOKE ALL ON public.plugin_releases   FROM anon;