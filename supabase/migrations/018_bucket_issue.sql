-- plugin-releases storage bucket: backs the admin plugin upload/download flow
-- (app/api/admin/plugin/upload/route.ts, app/api/plugin/download/route.ts,
-- app/api/plugin/update/route.ts). This bucket never existed on the live project —
-- found while debugging "Object not found" / "Bucket not found" errors on plugin
-- downloads. Without it, uploads via the admin plugin page were either failing
-- outright or (under an earlier, pre-fix version of the upload route) silently
-- writing to Render's ephemeral local disk instead, which never survives a redeploy.
--
-- Kept private (public=false) — releases are only ever served through the
-- signed-URL routes above, both of which use the service_role admin client and so
-- bypass RLS regardless. No RLS policy is added here for the same reason migration
-- 017 didn't need one beyond a service_role grant: there's no anon/authenticated
-- caller that should ever reach this bucket directly.

INSERT INTO storage.buckets (id, name, public)
VALUES ('plugin-releases', 'plugin-releases', false)
ON CONFLICT (id) DO NOTHING;