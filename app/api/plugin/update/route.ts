import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySiteToken } from '@/lib/security/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — long enough for WP's upgrader to fetch it

export async function GET(request: Request) {
  try {
    // 1. The requesting site must present a valid, unrevoked site token.
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const rate = await checkRateLimit('ingest', auth.site_id!);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const supabase = createAdminClient();

    // 2. The site's license must exist and be tied to an active, unexpired subscription —
    //    not just "any authenticated site" gets the update package.
    const { data: license } = await supabase
      .from('licenses')
      .select('subscription_id')
      .eq('id', auth.site.license_id)
      .single();

    if (!license?.subscription_id) {
      return NextResponse.json({ error: 'No license associated with this site' }, { status: 403 });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('id', license.subscription_id)
      .single();

    const isSubActive = sub?.status === 'active' &&
      !!sub.current_period_end &&
      new Date(sub.current_period_end) > new Date();

    if (!isSubActive) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
    }

    // 3. Fetch the latest release.
    const { data: release, error } = await supabase
      .from('plugin_releases')
      .select('version, zip_path, changelog, released_at, signature')
      .eq('is_latest', true)
      .single();

    if (error || !release) {
      return NextResponse.json({ error: 'No release found' }, { status: 404 });
    }

    // 4. Generate a short-lived signed URL from private Supabase Storage. This is what
    //    WordPress's core upgrader will fetch directly — no Authorization header needed
    //    at fetch time, the signed URL itself is the time-limited credential. This also
    //    fixes the previous design, which wrote release zips to local disk on Render —
    //    an ephemeral filesystem that gets wiped on every redeploy.
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
      signature:    release.signature, // base64 ECDSA signature of the zip's sha256 hash
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