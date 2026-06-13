import psycopg2
from psycopg2.extras import RealDictCursor
import json

CONNECTION_STRING = "postgresql://postgres.awyihjjjlnqbhccmfsoa:1uT67ZSnBPM5DFa5@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(CONNECTION_STRING, connect_timeout=10)
cur  = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("""
-- ============================================================
-- WPShield Schema Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. plans — add max_sites, plan_family, price columns
ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_sites integer NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_family text NOT NULL DEFAULT 'solo';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_usd numeric(10,2) NOT NULL DEFAULT 10.00;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_inr_test integer NOT NULL DEFAULT 1;

-- Update existing plan rows if any
UPDATE plans SET plan_family = 'solo', max_sites = 1, price_usd = 10.00, price_inr_test = 1 WHERE id = 'starter';
UPDATE plans SET plan_family = 'growth', max_sites = 5, price_usd = 30.00, price_inr_test = 5 WHERE id = 'growth';

-- Insert plans (ignore if already exist)
INSERT INTO plans (id, name, price, price_id, price_usd, price_inr_test, max_sites, plan_family)
VALUES
  ('starter', 'Starter', 10, 'price_starter_paynimo', 10.00, 1, 1, 'solo'),
  ('growth',  'Growth',  30, 'price_growth_paynimo',  30.00, 5, 5, 'growth')
ON CONFLICT (id) DO UPDATE SET
  price_id       = EXCLUDED.price_id,
  price_usd      = EXCLUDED.price_usd,
  price_inr_test = EXCLUDED.price_inr_test,
  max_sites      = EXCLUDED.max_sites,
  plan_family    = EXCLUDED.plan_family;

-- Remove trial plan
DELETE FROM plans WHERE id = 'trial';

-- 2. licenses — add max_sites
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_sites integer NOT NULL DEFAULT 1;

-- 3. sites — add is_active, normalized_domain, deactivated_at
ALTER TABLE sites ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS normalized_domain text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- Backfill normalized_domain from url
UPDATE sites SET normalized_domain = regexp_replace(
  regexp_replace(url, '^https?://(www\.)?', ''),
  '/.*$', ''
) WHERE normalized_domain IS NULL;

-- 4. customers — add region_type, customer_type
ALTER TABLE customers ADD COLUMN IF NOT EXISTS region_type text NOT NULL DEFAULT 'india';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type text NOT NULL DEFAULT 'site_owner';

-- 5. pending_checkouts — new table for tamper-proof payment verification
CREATE TABLE IF NOT EXISTS pending_checkouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  plan_id         text NOT NULL REFERENCES plans(id),
  txn_ref         text NOT NULL UNIQUE,
  expected_amount_inr integer NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pending_checkouts_txn_ref_idx ON pending_checkouts(txn_ref);
CREATE INDEX IF NOT EXISTS pending_checkouts_user_id_idx ON pending_checkouts(user_id);

-- 6. plugin_releases — new table for auto-update system
CREATE TABLE IF NOT EXISTS plugin_releases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version         text NOT NULL UNIQUE,
  changelog       text,
  zip_path        text NOT NULL,
  zip_url         text NOT NULL,
  is_latest       boolean NOT NULL DEFAULT false,
  released_by     uuid REFERENCES auth.users(id),
  released_at     timestamptz NOT NULL DEFAULT now()
);
-- Only one row can be latest at a time (enforced via app logic)
CREATE INDEX IF NOT EXISTS plugin_releases_is_latest_idx ON plugin_releases(is_latest);
""")
conn.commit()
    
print("\n--- Migration Status ---")
print("✔ Tables 'plans', 'licenses', 'sites', and 'customers' successfully altered.")
print("✔ Table 'pending_checkouts' created or verified.")
print("✔ Table 'plugin_releases' created or verified.")
print("✔ Database migration executed completely.")

cur.close()
conn.close()