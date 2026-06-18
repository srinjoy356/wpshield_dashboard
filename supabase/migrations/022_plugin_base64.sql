-- RG-13: plugin_releases had a signature but no independent checksum — meaning there
-- was no way to verify or diagnose a release's integrity except by trusting the
-- signature blob itself. sha256_checksum lets an admin (or the plugin, alongside
-- signature verification) confirm a downloaded zip matches exactly what was uploaded,
-- independent of the signing keypair.

ALTER TABLE public.plugin_releases ADD COLUMN IF NOT EXISTS sha256_checksum text;
ALTER TABLE public.plugin_releases ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
ALTER TABLE public.plugin_releases ADD COLUMN IF NOT EXISTS signing_key_id text;

COMMENT ON COLUMN public.plugin_releases.sha256_checksum IS 'hex sha256 of the release zip, computed at upload time';
COMMENT ON COLUMN public.plugin_releases.signing_key_id IS 'identifies which signing keypair was used — lets you rotate keys later without breaking verification of releases signed under an older key';