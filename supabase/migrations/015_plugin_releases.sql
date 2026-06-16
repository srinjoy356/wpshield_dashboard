-- plugin_releases — zip_path now stores a Supabase Storage object key (bucket
-- "plugin-releases"), not a local filesystem path. signature is the base64 ECDSA
-- signature of the release zip's sha256 hash, produced at upload time and verified by
-- the plugin's updater before it lets WordPress install the package.

CREATE TABLE IF NOT EXISTS public.plugin_releases (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version     text        NOT NULL,
  changelog   text,
  zip_path    text        NOT NULL, -- Supabase Storage object key
  zip_url     text        NOT NULL, -- admin-only manual download link, not used by the WP auto-updater
  signature   text,                 -- base64 ECDSA-P256 signature, sha256 of the zip
  is_latest   boolean     NOT NULL DEFAULT false,
  released_by uuid        REFERENCES auth.users(id),
  released_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.plugin_releases IS 'WordPress plugin release history, served via /api/plugin/update';

ALTER TABLE public.plugin_releases ADD COLUMN IF NOT EXISTS signature text;

CREATE INDEX IF NOT EXISTS idx_plugin_releases_is_latest ON public.plugin_releases (is_latest);