import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteToken } from '@/lib/security/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — long enough for WP's upgrader to fetch it

export async function GET(request: Request) {
  try {
    // 1. The requesting site must present a valid, unrevoked site token.
    //    This is true for both free (Core) and paid sites — the plugin itself
    //    is available to all connected sites. Plan gating is enforced by the
    //    config sync response (is_premium flag), not by withholding the zip.
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const rate = await checkRateLimit('ingest', auth.site_id!);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const supabase = createAdminClient();

    // 2. Fetch the latest release — no subscription check.
    //    Any authenticated site (free or paid) can receive plugin updates.
    const { data: release, error } = await supabase
      .from('plugin_releases')
      .select('version, zip_path, changelog, released_at, signature, sha256_checksum')
      .eq('is_latest', true)
      .single();

    if (error || !release) {
      return NextResponse.json({ error: 'No release found' }, { status: 404 });
    }

    // 3. Generate a short-lived signed URL from Supabase Storage.
    const { data: signed, error: signErr } = await supabase.storage
      .from('plugin-releases')
      .createSignedUrl(release.zip_path, SIGNED_URL_TTL_SECONDS);

    if (signErr || !signed) {
      console.error('[Plugin Update] Failed to sign URL:', signErr?.message);
      return NextResponse.json({ error: 'Release storage error' }, { status: 500 });
    }

    return NextResponse.json({
      version:      release.version,
      download_url: signed.signedUrl,
      changelog:    release.changelog,
      released_at:  release.released_at,
      signature:    release.signature,
      sha256:       release.sha256_checksum,
      name:         'WPShield Security',
      slug:         'cybernara-wpshield',
      author:       'Cybernara',
      requires:     '5.8',
      tested:       '6.7',
      sections: {
        description: 'Advanced WordPress security monitoring and protection by Cybernara.',
        changelog:   release.changelog || 'Bug fixes and improvements.',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}