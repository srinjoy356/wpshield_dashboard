import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit('activation', getClientIdentifier(request));
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many activation attempts. Please try again later.' }, { status: 429 });
    }

    const { license_key, site_url } = await request.json();
    if (!license_key || !site_url) {
      return NextResponse.json({ error: 'Missing license_key or site_url' }, { status: 400 });
    }

    const trimmedKey  = license_key.trim();
    const providedHash = crypto.createHash('sha256').update(trimmedKey).digest('hex');

    const supabase = createAdminClient();

    // 1. Verify license
    const { data: license, error: fetchError } = await supabase
      .from('licenses')
      .select('id, subscription_id, status, max_sites')
      .eq('key_hash', providedHash)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: 'Database error' }, { status: 500 });
    if (!license || license.status !== 'active') {
      return NextResponse.json({ error: 'Invalid or inactive license' }, { status: 401 });
    }

    // 2. Verify the subscription itself is actually active and not past its period end.
    //    A license row can be left status='active' while the underlying subscription has
    //    lapsed (past_due, cancelled, or simply expired) — that must block new activations.
    const { data: subForCheck } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('id', license.subscription_id)
      .single();

    const isSubActive = subForCheck?.status === 'active' &&
      !!subForCheck.current_period_end &&
      new Date(subForCheck.current_period_end) > new Date();

    if (!isSubActive) {
      return NextResponse.json({ error: 'Subscription is expired or inactive' }, { status: 403 });
    }

    // 3. Resolve company — fail hard if not found (no default_company_id fallback)
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('customer_id')
      .eq('id', license.subscription_id)
      .single();

    const { data: customer } = await supabase
      .from('customers')
      .select('owner_user_id')
      .eq('id', sub?.customer_id)
      .single();

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', customer?.owner_user_id)
      .maybeSingle();

    if (!userProfile?.company_id) {
      return NextResponse.json({ error: 'License is not linked to a valid account. Please contact support.' }, { status: 403 });
    }

    const company_id = userProfile.company_id;

    // 4. Normalize domain for dedup check — use the URL parser instead of a regex so
    //    ports, IDNA/punycode hosts, double slashes, and malformed input are all handled
    //    the same way the browser/WordPress itself would interpret the URL.
    let normalized_domain: string;
    try {
      const parsedUrl = new URL(site_url.startsWith('http') ? site_url : `https://${site_url}`);
      normalized_domain = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return NextResponse.json({ error: 'Invalid site URL' }, { status: 400 });
    }

    // 5. Check if this domain is already active under this company
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id, is_active, license_id')
      .eq('company_id', company_id)
      .eq('normalized_domain', normalized_domain)
      .maybeSingle();

    if (existingSite) {
      if (existingSite.is_active && existingSite.license_id === license.id) {
        // Already active on this exact license — revoke old tokens and issue a new one
        await supabase.from('site_tokens').update({ revoked: true }).eq('site_id', existingSite.id);
        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await supabase.from('site_tokens').insert({
          site_id: existingSite.id, token_prefix: rawToken.substring(0, 8), token_hash: tokenHash,
        });
        return NextResponse.json({ success: true, site_token: rawToken, company_id });
      } else {
        // Previously deactivated, OR moving from Free to Pro (or changing license)
        await supabase.from('sites').update({
          is_active: true, deactivated_at: null, url: site_url, last_seen_at: new Date().toISOString(),
          license_id: license.id
        }).eq('id', existingSite.id);

        await supabase.from('site_tokens').update({ revoked: true }).eq('site_id', existingSite.id);
        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await supabase.from('site_tokens').insert({
          site_id: existingSite.id, token_prefix: rawToken.substring(0, 8), token_hash: tokenHash,
        });
        return NextResponse.json({ success: true, site_token: rawToken, company_id });
      }
    }

    // 6. Check plan site limit
    const maxSites = license.max_sites ?? 1;
    const { count: activeCount } = await supabase
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('license_id', license.id)
      .eq('is_active', true);

    if ((activeCount ?? 0) >= maxSites) {
      return NextResponse.json({
        error: `Site limit reached. Your plan allows ${maxSites} active site${maxSites > 1 ? 's' : ''}. Deactivate an existing site first or upgrade your plan.`
      }, { status: 403 });
    }

    // 7. Register new site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .insert({ company_id, license_id: license.id, url: site_url, normalized_domain, is_active: true })
      .select('id')
      .single();

    if (siteError) throw siteError;

    // 8. Generate site token
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await supabase.from('site_tokens').insert({
      site_id: site.id, token_prefix: rawToken.substring(0, 8), token_hash: tokenHash,
    });

    return NextResponse.json({ success: true, site_token: rawToken, company_id });

  } catch (err: any) {
    console.error('[License Activate]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}