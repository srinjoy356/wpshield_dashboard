-- Commercial schema, part 4: licenses + sites + site_tokens
-- site_tokens.last_used_at lets you eventually detect stale/abandoned tokens; nothing
-- currently writes to it — that's a follow-up, not part of this pass.

CREATE TABLE IF NOT EXISTS public.licenses (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid        REFERENCES public.subscriptions(id),
  key_hash        text        NOT NULL UNIQUE,
  status          text        NOT NULL,
  max_sites       integer     NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.licenses IS 'key_hash is sha256(raw license key) — the raw key is only ever shown once, by email, at issuance';

CREATE INDEX IF NOT EXISTS idx_licenses_subscription_id ON public.licenses (subscription_id);

CREATE TABLE IF NOT EXISTS public.sites (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        text        REFERENCES public.companies(company_id),
  license_id        uuid        REFERENCES public.licenses(id),
  url               text        NOT NULL,
  normalized_domain text,
  plugin_version    text,
  last_seen_at      timestamptz,
  is_active         boolean     NOT NULL DEFAULT true,
  deactivated_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.sites IS 'One row per WordPress install activated against a license';

CREATE INDEX IF NOT EXISTS idx_sites_license_id ON public.sites (license_id);
CREATE INDEX IF NOT EXISTS idx_sites_company_id ON public.sites (company_id);
CREATE INDEX IF NOT EXISTS idx_sites_normalized_domain ON public.sites (normalized_domain);

CREATE TABLE IF NOT EXISTS public.site_tokens (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       uuid        REFERENCES public.sites(id),
  token_prefix  text        NOT NULL,
  token_hash    text        NOT NULL UNIQUE,
  revoked       boolean     NOT NULL DEFAULT false,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.site_tokens IS 'token_hash is sha256(raw bearer token) — verified per-request in lib/security/guards.ts';

-- site_tokens already exists on your live database (without this column) — CREATE
-- TABLE IF NOT EXISTS above is a no-op in that case and would not have added it.
ALTER TABLE public.site_tokens ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_site_tokens_site_id ON public.site_tokens (site_id);