import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeFetch } from '@/lib/security/ssrf';

/**
 * POST /api/blocking/purge-site-cache
 *
 * Called internally by the Coraza Shadow WAF engine after auto-banning an IP.
 * Forces the WordPress site to drop its local config cache so the ban takes
 * effect in ~1 second instead of waiting up to the cache TTL.
 *
 * Internal-only — protected by x-wpshield-internal-secret header.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-wpshield-internal-secret');
    if (!secret || secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { company_id, ip } = body;

    if (!company_id || !ip) {
      return NextResponse.json({ error: 'company_id and ip are required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: site, error: siteErr } = await supabase
      .from('sites')
      .select('id, url')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (siteErr || !site?.url) {
      console.error('[PurgeSiteCache] Site not found:', company_id, siteErr);
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const { data: tokenData, error: tokenErr } = await supabase
      .from('site_tokens')
      .select('token_hash')
      .eq('site_id', site.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenErr || !tokenData?.token_hash) {
      console.error('[PurgeSiteCache] Token not found for site:', site.id, tokenErr);
      return NextResponse.json({ error: 'Site token not found' }, { status: 404 });
    }

    const siteUrl  = site.url.replace(/\/$/, '');
    const endpoint = `${siteUrl}/wp-json/wpshield/v1/purge-config-cache`;

    // safeFetch blocks SSRF to private/internal IPs.
    const wpResponse = await safeFetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${tokenData.token_hash}`,
      },
      body:   JSON.stringify({ triggered_by: 'shadow_waf', banned_ip: ip }),
      signal: AbortSignal.timeout(8000),
    });

    if (!wpResponse.ok) {
      const errText = await wpResponse.text();
      console.error('[PurgeSiteCache] WordPress non-200:', wpResponse.status, errText);
      return NextResponse.json({
        success: false,
        message: 'Ban recorded. WordPress cache purge failed — will sync on next cron.',
        wp_status: wpResponse.status,
      });
    }

    console.log(`[PurgeSiteCache] Cache purged on ${siteUrl} after banning ${ip}`);
    return NextResponse.json({ success: true, message: 'WordPress config cache purged.' });

  } catch (error: any) {
    if (error.message?.startsWith('SSRF Blocked')) {
      console.error('[PurgeSiteCache] SSRF attempt blocked:', error.message);
      return NextResponse.json({ error: 'Invalid site URL' }, { status: 400 });
    }
    console.error('[PurgeSiteCache] Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}