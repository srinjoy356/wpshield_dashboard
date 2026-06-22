-- 026_managed_services.sql
--
-- Adds the full managed-services commercial model:
--   service_addons          — catalog of purchasable managed services
--   customer_addons         — customer purchases of those services
--   managed_service_tasks   — per-period fulfillment tasks, assigned to analysts
--
-- Design decisions:
--   - scope_type = 'account' means the add-on covers all sites for a customer
--   - scope_type = 'site' means it covers a specific site (customer_addons.site_id is set)
--   - One task row per (customer_addon, service_month) via UNIQUE constraint
--   - All amounts in the catalog are live prices only (no test/live split needed —
--     managed services are always sold by Cybernara directly)

-- ── Service catalog ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_addons (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      text        UNIQUE NOT NULL,
  name                      text        NOT NULL,
  description               text,
  scope_type                text        NOT NULL DEFAULT 'site'
                            CHECK (scope_type IN ('account', 'site')),
  billing_interval          text        NOT NULL DEFAULT 'monthly'
                            CHECK (billing_interval IN ('monthly', 'yearly', 'one_time')),
  price_inr_live            numeric(10,2),
  price_usd_live            numeric(10,2),
  currency                  text        NOT NULL DEFAULT 'INR',
  included_deliverables     text[],
  -- SLA fields
  response_time_hours       integer     DEFAULT 48,
  review_frequency          text        DEFAULT 'monthly',
  remediation_scope         text,
  emergency_support         boolean     DEFAULT false,
  sla_breach_notify_at_hours integer    DEFAULT 72,
  is_active                 boolean     NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- ── Customer purchases ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_addons (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id               uuid        NOT NULL REFERENCES customers(id),
  site_id                   uuid        REFERENCES sites(id),  -- null = account-scoped
  service_addon_id          uuid        NOT NULL REFERENCES service_addons(id),
  status                    text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  current_period_start      timestamptz NOT NULL DEFAULT now(),
  current_period_end        timestamptz,
  purchased_from_invoice_id uuid,
  cancelled_at              timestamptz,
  cancellation_reason       text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- ── Fulfillment tasks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.managed_service_tasks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_addon_id   uuid        NOT NULL REFERENCES customer_addons(id),
  -- The first day of the calendar month this task covers
  service_month       date        NOT NULL,
  assigned_analyst_id uuid,        -- references auth.users
  priority            text        NOT NULL DEFAULT 'normal'
                      CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  sla_due_at          timestamptz,
  status              text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'escalated', 'cancelled')),
  notes               text,
  report_url          text,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- One task per purchase per month
  UNIQUE (customer_addon_id, service_month)
);

-- ── Invoice line item type ───────────────────────────────────────────────────
-- Allows invoices to distinguish managed-service line items from plugin subscription fees
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS line_item_type text DEFAULT 'subscription'
  CHECK (line_item_type IN ('subscription', 'managed_service', 'one_time'));

-- ── Initial catalog rows ─────────────────────────────────────────────────────
INSERT INTO public.service_addons
  (code, name, description, scope_type, billing_interval, price_inr_live, currency,
   included_deliverables, response_time_hours, review_frequency, remediation_scope)
VALUES
  (
    'managed_review_monthly',
    'Managed Monthly Security Review',
    'Monthly security review by a Cybernara analyst — plugin audit, hardening check, suspicious login review, written PDF report.',
    'site', 'monthly', 1499, 'INR',
    ARRAY['monthly_review', 'hardening_check', 'suspicious_login_review', 'report'],
    48, 'monthly', 'advisory'
  ),
  (
    'managed_cleanup_onetime',
    'One-Time Malware Cleanup',
    'Single malware cleanup and site restoration by a Cybernara analyst. Includes a post-cleanup report.',
    'site', 'one_time', 4999, 'INR',
    ARRAY['malware_cleanup', 'file_quarantine', 'report'],
    24, 'one_time', 'full_remediation'
  )
ON CONFLICT (code) DO NOTHING;

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT ALL ON public.service_addons        TO service_role;
GRANT ALL ON public.customer_addons       TO service_role;
GRANT ALL ON public.managed_service_tasks TO service_role;