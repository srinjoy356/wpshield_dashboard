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
    let blockedIps: string[]     = [];
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
        // Blocked IPs
        const { data: ips } = await supabase
          .from('wpshield_blocked_ips')
          .select('ip')
          .eq('company_id', auth.site.company_id)
          .eq('is_active', true);
        if (ips) blockedIps = ips.map(r => r.ip);

        // Blocked countries — was missing, geo blocking was non-functional without this
        const { data: countries } = await supabase
          .from('wpshield_blocked_countries')
          .select('country_code')
          .eq('company_id', auth.site.company_id);
        if (countries) blockedCountries = countries.map(r => r.country_code);
      }
    }

    const config = {
      blocking_enabled:    company?.blocking_enabled    && isPremium,
      blocked_ips:         blockedIps,
      blocked_countries:   blockedCountries,
      maintenance_mode:    company?.maintenance_mode    && isPremium,
      away_mode_schedule:  company?.away_mode_schedule  && isPremium ? company.away_mode_schedule : null,
      footer_attribution:  company?.footer_attribution  ?? true,
      is_premium:          isPremium,
    };

    // HMAC signature — verified by the WordPress plugin on receipt.
    // Key = site_token (shared secret), so the dashboard can't be spoofed.
    const signingKey = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const signature  = crypto
      .createHmac('sha256', signingKey)
      .update(JSON.stringify(config))
      .digest('hex');

    return NextResponse.json({ config, signature });

  } catch (err: any) {
    console.error('[site/config]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}