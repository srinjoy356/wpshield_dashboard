-- ============================================================
-- WPShield Collector — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Attack events (SQLi, XSS, LFI, RCE, scanner UA, sensitive 404s, XML-RPC)
create table if not exists wpshield_events_attack (
  id           bigserial primary key,
  company_id   text        not null,
  site_url     text        not null,
  severity     text        not null,   -- low | medium | high | critical
  pattern_type text        not null,   -- sqli | xss | lfi | rce | wpscan_ua | sensitive_404 | xmlrpc_call
  ip           text,
  method       text,
  uri          text,
  user_agent   text,
  occurred_at  timestamptz not null default now()
);

create index if not exists idx_attack_company_time on wpshield_events_attack (company_id, occurred_at desc);
create index if not exists idx_attack_severity     on wpshield_events_attack (severity);
create index if not exists idx_attack_pattern      on wpshield_events_attack (pattern_type);

-- Login events (success, failure, logout, role change, new user)
create table if not exists wpshield_events_login (
  id           bigserial primary key,
  company_id   text        not null,
  site_url     text        not null,
  severity     text        not null,
  event        text        not null,   -- login_success | login_failed | logout | role_changed | user_created
  user_id      bigint,
  login        text,
  ip           text,
  roles_json   text,                   -- JSON array of roles
  occurred_at  timestamptz not null default now()
);

create index if not exists idx_login_company_time on wpshield_events_login (company_id, occurred_at desc);
create index if not exists idx_login_event        on wpshield_events_login (event);

-- File integrity events (added, modified, deleted PHP files)
create table if not exists wpshield_events_file (
  id           bigserial primary key,
  company_id   text        not null,
  site_url     text        not null,
  severity     text        not null,
  event        text        not null,   -- file_added | file_modified | file_deleted
  path         text        not null,
  old_hash     text,
  new_hash     text,
  size         bigint,
  occurred_at  timestamptz not null default now()
);

create index if not exists idx_file_company_time on wpshield_events_file (company_id, occurred_at desc);
create index if not exists idx_file_path         on wpshield_events_file (path);

-- Health / inventory snapshots (core, plugins, themes — once per 24h)
create table if not exists wpshield_inventory_snapshots (
  id           bigserial primary key,
  company_id   text        not null,
  site_url     text        not null,
  severity     text        not null default 'low',
  kind         text        not null,   -- core | plugins | themes | test_ping
  payload      jsonb       not null,   -- full snapshot as JSON
  occurred_at  timestamptz not null default now()
);

create index if not exists idx_snapshot_company_kind_time
  on wpshield_inventory_snapshots (company_id, kind, occurred_at desc);

-- ============================================================
-- Row Level Security (RLS) — enable once your dashboard user
-- is set up. The plugin uses the service-role key (bypasses RLS).
-- ============================================================

-- alter table wpshield_events_attack        enable row level security;
-- alter table wpshield_events_login         enable row level security;
-- alter table wpshield_events_file          enable row level security;
-- alter table wpshield_inventory_snapshots  enable row level security;

-- Example read-only policy (adjust to your auth setup):
-- create policy "tenant read-own" on wpshield_events_attack
--   for select using (company_id = current_setting('app.company_id', true));
