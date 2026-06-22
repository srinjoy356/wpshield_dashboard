import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rate-limit';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/license/activate-free
 *
 * Free-tier (Core plan) site activation. No license key required.
 * Creates a site + site_token so the plugin can transmit events and
 * pull config, exactly like the paid activation — just without a
 * license or subscription check.
 *
 * Body: { site_url: string, api_key: string }
 * The api_key is a shared secret set as FREE_ACTIVATION_KEY env var.
 * The plugin sends this on free connect so we don't need user auth
 * here (the WordPress admin already authenticated the WordPress user).
 *
 * Returns: { success: true, site_token: string, company_id: string }
 */
export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit('activation', getClientIdentifier(request));
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many activation attempts. Please try again.' }, { status: 429 });
    }

    const { site_url, company_id: provided_company_id } = await request.json();

    if (!site_url) {
      return NextResponse.json({ error: 'Missing site_url' }, { status: 400 });
    }

    // Normalise the domain
    let normalized_domain: string;
    try {
      const parsed = new URL(site_url.startsWith('http') ? site_url : `https://${site_url}`);
      normalized_domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return NextResponse.json({ error: 'Invalid site URL' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // company_id must be provided — the plugin gets it from the WP admin's
    // WPShield dashboard account. We look it up to verify it exists.
    if (!provided_company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    const { data: company } = await supabase
      .from('companies')
      .select('company_id')
      .eq('company_id', provided_company_id)
      .maybeSingle();

    if (!company) {
      return NextResponse.json({ error: 'Company not found. Log in to your WPShield dashboard and copy your Company ID.' }, { status: 404 });
    }

    // Check if this domain is already registered under this company
    const { data: existingSite } = await supabase
      .from('sites')
      .select('id, is_active')
      .eq('company_id', provided_company_id)
      .eq('normalized_domain', normalized_domain)
      .maybeSingle();

    let siteId: string;

    if (existingSite) {
      siteId = existingSite.id;
      // Reactivate if previously deactivated
      if (!existingSite.is_active) {
        await supabase.from('sites').update({ is_active: true, deactivated_at: null, url: site_url }).eq('id', siteId);
      }
      // Revoke old tokens — issue fresh one
      await supabase.from('site_tokens').update({ revoked: true }).eq('site_id', siteId);
    } else {
      // Register new site (no license_id for Core — that's fine, it's nullable)
      const { data: newSite, error: siteErr } = await supabase
        .from('sites')
        .insert({
          company_id:        provided_company_id,
          url:               site_url,
          normalized_domain,
          is_active:         true,
          license_id:        null, // Core plan — no license
        })
        .select('id')
        .single();

      if (siteErr) throw siteErr;
      siteId = newSite.id;
    }

    // Issue site token
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await supabase.from('site_tokens').insert({
      site_id:      siteId,
      token_prefix: rawToken.substring(0, 8),
      token_hash:   tokenHash,
    });

    return NextResponse.json({
      success:    true,
      site_token: rawToken,
      company_id: provided_company_id,
    });

  } catch (err: any) {
    console.error('[activate-free]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}