import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
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

    // 2. Resolve company — fail hard if not found (no default_company_id fallback)
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

    // 3. Normalize domain for dedup check
    const normalized_domain = site_url
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/.*$/, '')
      .toLowerCase();

    // 4. Check if this domain is already active on this license
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id, is_active')
      .eq('license_id', license.id)
      .eq('normalized_domain', normalized_domain)
      .maybeSingle();

    if (existingSite) {
      if (existingSite.is_active) {
        // Already active — return existing token instead of creating duplicate
        const { data: existingToken } = await supabase
          .from('site_tokens')
          .select('token_prefix')
          .eq('site_id', existingSite.id)
          .eq('revoked', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Revoke old tokens and issue new one
        await supabase.from('site_tokens').update({ revoked: true }).eq('site_id', existingSite.id);
        const rawToken  = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        await supabase.from('site_tokens').insert({
          site_id: existingSite.id, token_prefix: rawToken.substring(0, 8), token_hash: tokenHash,
        });
        return NextResponse.json({ success: true, site_token: rawToken, company_id });
      } else {
        // Previously deactivated — reactivate
        await supabase.from('sites').update({
          is_active: true, deactivated_at: null, url: site_url, last_seen_at: new Date().toISOString(),
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

    // 5. Check plan site limit
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

    // 6. Register new site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .insert({ company_id, license_id: license.id, url: site_url, normalized_domain, is_active: true })
      .select('id')
      .single();

    if (siteError) throw siteError;

    // 7. Generate site token
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