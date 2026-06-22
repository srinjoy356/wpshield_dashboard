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

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', auth.site.company_id)
      .single();

    const { data: license } = await supabase
      .from('licenses')
      .select('subscription_id')
      .eq('id', auth.site.license_id)
      .single();

    let isPremium = false;
    let blockedIps: string[]      = [];
    let blockedCountries: string[] = [];

    if (license) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('id', license.subscription_id)
        .single();

      const isNotExpired = sub?.current_period_end
        ? new Date(sub.current_period_end) > new Date()
        : false;
      isPremium = sub?.status === 'active' && isNotExpired;

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
    }

    // ── Per-site overrides (Stream 3) ─────────────────────────────────────
    // When site_controls_enabled = true AND the subscription is premium,
    // the site's own maintenance_mode / away_mode_schedule takes precedence
    // over the company-level values. When false (the default), the site
    // inherits company settings exactly as before — fully backward compatible.
    const { data: siteRow } = await supabase
      .from('sites')
      .select('maintenance_mode, away_mode_schedule, site_controls_enabled')
      .eq('id', auth.site_id)
      .single();

    const useSiteLevel = (siteRow?.site_controls_enabled === true) && isPremium;

    const maintenanceMode = useSiteLevel
      ? (siteRow?.maintenance_mode ?? false)
      : (company?.maintenance_mode ?? false) && isPremium;

    const awayModeSchedule = useSiteLevel
      ? (siteRow?.away_mode_schedule ?? null)
      : (company?.away_mode_schedule && isPremium ? company.away_mode_schedule : null);

    const now = new Date();
    const config = {
      blocking_enabled:    company?.blocking_enabled    && isPremium,
      blocked_ips:         blockedIps,
      blocked_countries:   blockedCountries,
      maintenance_mode:    maintenanceMode,
      away_mode_schedule:  awayModeSchedule,
      footer_attribution:  company?.footer_attribution  ?? true,
      is_premium:          isPremium,
      // Per-site control flag — lets future plugin versions know which mode is active
      site_controls_enabled: useSiteLevel,
      issued_at:           now.toISOString(),
      expires_at:          new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      config_version:      1,
    };

    const configJson  = JSON.stringify(config);
    const signingKey  = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const signature   = crypto
      .createHmac('sha256', signingKey)
      .update(configJson)
      .digest('hex');

    return NextResponse.json({ config, config_json: configJson, signature });

  } catch (err: any) {
    console.error('[site/config]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}