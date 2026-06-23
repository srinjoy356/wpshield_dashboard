import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const supabase = createAdminClient();

    // Load company
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', auth.site.company_id)
      .single();

    // Load per-site overrides — always needed regardless of plan
    const { data: siteRow } = await supabase
      .from('sites')
      .select('maintenance_mode, away_mode_schedule, site_controls_enabled, license_id')
      .eq('id', auth.site_id)
      .single();

    // Determine premium status via the site's license → subscription
    // Sites can have license_id either on the auth.site object or the siteRow
    const licenseId = auth.site.license_id || siteRow?.license_id || null;

    let isPremium = false;
    let blockedIps: string[]       = [];
    let blockedCountries: string[] = [];

    if (licenseId) {
      const { data: license } = await supabase
        .from('licenses')
        .select('subscription_id, status')
        .eq('id', licenseId)
        .maybeSingle();

      if (license?.subscription_id && license.status === 'active') {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, current_period_end')
          .eq('id', license.subscription_id)
          .maybeSingle();

        isPremium = sub?.status === 'active' &&
          !!sub.current_period_end &&
          new Date(sub.current_period_end) > new Date();
      }
    }

    // Load premium-only data
    if (isPremium) {
      const { data: ips } = await supabase
        .from('wpshield_blocked_ips')
        .select('ip')
        .eq('company_id', auth.site.company_id)
        .eq('is_active', true);
      if (ips) blockedIps = ips.map(r => r.ip);

      const { data: countries } = await supabase
        .from('wpshield_blocked_countries')
        .select('country_code')
        .eq('company_id', auth.site.company_id);
      if (countries) blockedCountries = countries.map(r => r.country_code);
    }

    // ── Feature resolution ────────────────────────────────────────────────
    //
    // Maintenance mode: available on ALL plans including Core (free).
    //   - If site has per-site controls enabled → use sites.maintenance_mode
    //   - Otherwise → use companies.maintenance_mode
    //   - NOT gated by isPremium
    //
    // Away mode / IP blocking / Geo blocking: premium only.
    //   - Only sent when isPremium = true
    //
    // Per-site controls: only meaningful for premium (per-site away mode
    //   requires a paid plan). For maintenance mode it works for everyone.

    const useSiteLevel = siteRow?.site_controls_enabled === true;

    // Maintenance mode — Core and above
    const maintenanceMode = useSiteLevel
      ? (siteRow?.maintenance_mode ?? false)
      : (company?.maintenance_mode ?? false);

    // Away mode — premium only, per-site or company-level
    const awayModeSchedule = isPremium
      ? (useSiteLevel
          ? (siteRow?.away_mode_schedule ?? null)
          : (company?.away_mode_schedule ?? null))
      : null;

    const now = new Date();
    const config = {
      // Available to all connected sites
      maintenance_mode:    maintenanceMode,
      footer_attribution:  company?.footer_attribution ?? true,
      is_premium:          isPremium,
      site_controls_enabled: useSiteLevel,

      // Premium only
      blocking_enabled:    company?.blocking_enabled && isPremium,
      blocked_ips:         blockedIps,
      blocked_countries:   blockedCountries,
      away_mode_schedule:  awayModeSchedule,

      // Freshness fields
      issued_at:    now.toISOString(),
      expires_at:   new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      config_version: 1,
    };

    const configJson = JSON.stringify(config);
    // Sign with the raw site token (the bearer value the plugin sent)
    const signingKey = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const signature  = crypto
      .createHmac('sha256', signingKey)
      .update(configJson)
      .digest('hex');

    return NextResponse.json({ config, config_json: configJson, signature });

  } catch (err: any) {
    console.error('[site/config]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}