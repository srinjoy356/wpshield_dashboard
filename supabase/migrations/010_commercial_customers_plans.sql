-- Commercial schema, part 1: customers + plans + entitlements
-- These tables exist today only in supabase/wpshield_full_schema.sql, which can't be
-- run predictably against a fresh environment. This brings them into the numbered
-- migration chain.

CREATE TABLE IF NOT EXISTS public.customers (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id        uuid        REFERENCES auth.users(id),
  email                text        NOT NULL,
  country              text,
  provider_customer_id text,
  region_type          text        NOT NULL DEFAULT 'india',
  customer_type        text        NOT NULL DEFAULT 'site_owner',
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.customers IS 'Billing customers, one per paying owner_user_id';

CREATE TABLE IF NOT EXISTS public.plans (
  id             text        PRIMARY KEY,
  price_id       text        NOT NULL,
  name           text        NOT NULL,
  price          numeric,
  max_sites      integer     NOT NULL DEFAULT 1,
  plan_family    text        NOT NULL DEFAULT 'solo',
  price_usd      numeric     NOT NULL DEFAULT 10.00,
  price_inr_test integer     NOT NULL DEFAULT 1,
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.plans IS 'Subscription plan catalog — price_inr_test is intentionally test pricing, not production pricing';

-- plans already exists on your live database (without this column) — CREATE TABLE IF
-- NOT EXISTS above is a no-op in that case and will NOT add it. Without this line,
-- migration 016's "active = true" RLS policy on plans would fail outright with
-- "column active does not exist."
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.entitlements (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id       text        REFERENCES public.plans(id),
  feature_key   text        NOT NULL,
  feature_value jsonb,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.entitlements IS 'Per-plan feature flags/limits — reserved for future use';

CREATE INDEX IF NOT EXISTS idx_customers_owner_user_id ON public.customers (owner_user_id);

-- Seed test plans — kept as test pricing intentionally (not production prices).
INSERT INTO public.plans (id, price_id, name, price, max_sites, plan_family, price_usd, price_inr_test)
VALUES
  ('starter', 'price_starter_paynimo', 'Starter', 10, 1, 'solo',   10.00, 1),
  ('growth',  'price_growth_paynimo',  'Growth',  30, 5, 'growth', 30.00, 5)
ON CONFLICT (id) DO UPDATE SET
  price_usd      = EXCLUDED.price_usd,
  price_inr_test = EXCLUDED.price_inr_test,
  max_sites      = EXCLUDED.max_sites,
  plan_family    = EXCLUDED.plan_family;