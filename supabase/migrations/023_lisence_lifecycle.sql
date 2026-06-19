-- Billing hardening: RG-01 (license key escrow + delivery tracking), RG-02/03
-- (production pricing + region/currency schema), RG-10 (invoice/GST fields),
-- RG-11 (subscription lifecycle states).
--
-- Every new column here is nullable / has a safe default — nothing in this
-- migration requires real pricing numbers, a GSTIN, or a tax rate to exist
-- before it can be applied. Those get filled in later without further
-- schema changes.

-- ── RG-01: license key escrow + delivery tracking ──────────────────────────
-- key_hash alone made the raw key permanently unrecoverable if email delivery
-- failed after issuance — there was no way to retrieve it again, by anyone,
-- for any reason. encrypted_key is a deliberate, narrow exception to that
-- "never recoverable" design: a reversible copy, protected by AES-256-GCM
-- with its own dedicated secret (never the same secret used to hash/sign
-- anything else), accessible only through an OTP-gated admin action that is
-- itself permanently logged in license_access_log below.
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS encrypted_key text;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS delivery_error text;
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS last_delivery_attempt_at timestamptz;

ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_delivery_status_check;
ALTER TABLE public.licenses ADD CONSTRAINT licenses_delivery_status_check
  CHECK (delivery_status IN ('pending', 'sent', 'failed', 'not_applicable'));

COMMENT ON COLUMN public.licenses.encrypted_key IS
  'AES-256-GCM ciphertext of the raw license key, base64 (iv:authtag:ciphertext). Decryptable only server-side via LICENSE_KEY_ENCRYPTION_SECRET, and only through the OTP-gated admin reveal flow. This is a deliberate exception to key_hash''s one-way design, scoped narrowly to recovering keys whose delivery email failed.';
COMMENT ON COLUMN public.licenses.delivery_status IS
  'pending = not yet attempted, sent = email succeeded, failed = email send threw, not_applicable = renewal (no new key issued)';

-- One-time OTP codes gating access to a license''s raw key. Deliberately
-- separate from mfa_codes (used for login 2FA) so requesting a reveal-OTP
-- never collides with an admin''s own in-progress login verification.
CREATE TABLE IF NOT EXISTS public.license_reveal_otps (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id   uuid        NOT NULL REFERENCES auth.users(id),
  license_id      uuid        NOT NULL REFERENCES public.licenses(id),
  code_hash       text        NOT NULL,
  expires_at      timestamptz NOT NULL,
  attempts        integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_license_reveal_otps_admin_license
  ON public.license_reveal_otps (admin_user_id, license_id);

-- Permanent audit trail — every reveal/resend is logged here regardless of
-- whether the reveal_otp row above has since expired or been deleted.
CREATE TABLE IF NOT EXISTS public.license_access_log (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id   uuid        NOT NULL REFERENCES auth.users(id),
  license_id      uuid        NOT NULL REFERENCES public.licenses(id),
  action          text        NOT NULL CHECK (action IN ('revealed', 'resent')),
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_license_access_log_license_id ON public.license_access_log (license_id);

ALTER TABLE public.license_reveal_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_access_log  ENABLE ROW LEVEL SECURITY;
-- Service-role only — these tables are never read/written from the browser,
-- only from server-side API routes using the admin client, same pattern as
-- mfa_codes and site_tokens.
DROP POLICY IF EXISTS "service_role_only" ON public.license_reveal_otps;
CREATE POLICY "service_role_only" ON public.license_reveal_otps FOR ALL USING (false);
DROP POLICY IF EXISTS "service_role_only" ON public.license_access_log;
CREATE POLICY "service_role_only" ON public.license_access_log FOR ALL USING (false);


-- ── RG-02 / RG-03: production pricing + region/currency catalog schema ─────
-- price_inr_test stays exactly as-is and keeps being what checkout actually
-- charges until IS_LIVE_MODE is explicitly turned on — these columns add the
-- capability without changing current (testnet) behavior at all.
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_inr_live numeric;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_usd_live numeric;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS currency        text NOT NULL DEFAULT 'INR';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS region          text NOT NULL DEFAULT 'india';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS tax_code        text;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS active_from     timestamptz NOT NULL DEFAULT timezone('utc', now());

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_region_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_region_check CHECK (region IN ('india', 'global'));
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_billing_interval_check;
ALTER TABLE public.plans ADD CONSTRAINT plans_billing_interval_check CHECK (billing_interval IN ('monthly', 'annual'));

COMMENT ON COLUMN public.plans.price_inr_live IS
  'Real production INR price. NULL until set — checkout only uses this when IS_LIVE_MODE=true, and falls back to price_inr_test if this is still NULL even in live mode (fails safe: never charges a NULL/zero amount).';


-- ── RG-10: invoice GST/tax compliance fields ────────────────────────────────
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number      text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency            text NOT NULL DEFAULT 'INR';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate            numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount          integer;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS gstin               text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS billing_address     text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS refund_status       text;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_refund_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_refund_status_check
  CHECK (refund_status IS NULL OR refund_status IN ('none', 'partial', 'full'));

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_key ON public.invoices (invoice_number) WHERE invoice_number IS NOT NULL;

-- Sequential invoice numbering — a real sequence, not a column default tied
-- to row insertion order, so numbers stay sequential even if invoices are
-- ever deleted/backfilled out of order. Format applied in application code
-- (e.g. WPS-2026-000123); the sequence itself just guarantees uniqueness +
-- monotonic ordering.
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

-- Exposed via PostgREST as supabase.rpc('next_invoice_number') — wraps
-- nextval() because a raw sequence isn't directly callable through the
-- Supabase client, and this keeps the increment atomic and gap-free even
-- under concurrent invoice creation (two simultaneous payments can never
-- get the same number, by the same guarantee any DB sequence gives you).
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS bigint
LANGUAGE sql
AS $$
  SELECT nextval('public.invoice_number_seq');
$$;

COMMENT ON COLUMN public.invoices.gstin IS
  'Cybernara''s own GST registration number, stamped onto every invoice at generation time — not a per-customer field. NULL until provided; invoices simply omit this line until then.';
COMMENT ON COLUMN public.invoices.tax_rate IS
  'NULL until a real rate is configured. Invoices render without a tax line while NULL rather than showing a fabricated 0%/18% figure.';


-- ── RG-11: subscription lifecycle ───────────────────────────────────────────
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancelled_at          timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at         timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grace_period_ends_at  timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS dunning_attempts      integer NOT NULL DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_dunning_at       timestamptz;

-- Existing rows may have statuses ('halted') that predate this constraint —
-- normalize known legacy values before the CHECK is added, so this migration
-- doesn't fail against real data.
UPDATE public.subscriptions SET status = 'past_due' WHERE status = 'halted';

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired'));

COMMENT ON COLUMN public.subscriptions.grace_period_ends_at IS
  'When a renewal payment fails, access continues until this timestamp before the subscription is actually cut off — gives dunning a window to recover the payment.';