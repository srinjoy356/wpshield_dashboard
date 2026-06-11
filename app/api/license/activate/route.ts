import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { license_key, site_url } = await request.json();
    if (!license_key || !site_url) {
      return NextResponse.json({ error: 'Missing license_key or site_url' }, { status: 400 });
    }

    const trimmedKey = license_key.trim();
    const providedHash = crypto.createHash('sha256').update(trimmedKey).digest('hex');
    console.log(`[API] Activating license key: '${trimmedKey}' (Hash: '${providedHash}') for site: '${site_url}'`);

    const supabase = createAdminClient();

    // Verify license
    const { data: license, error: fetchError } = await supabase
      .from('licenses')
      .select('id, subscription_id, status')
      .eq('key_hash', providedHash)
      .maybeSingle();

    console.log(`[API] License DB Result:`, { license, fetchError });

    if (fetchError) {
      console.error(`[API] DB Error:`, fetchError);
      return NextResponse.json({ error: 'Database error verifying license' }, { status: 500 });
    }

    if (!license || license.status !== 'active') {
      return NextResponse.json({ error: 'Invalid or inactive license' }, { status: 401 });
    }

    // Get Subscription and Company
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('customer_id, plan_id')
      .eq('id', license.subscription_id)
      .single();
      
    // Ideally map customer_id -> owner_user_id -> company_id
    // For now we assume one active company per customer
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

    const company_id = userProfile?.company_id || 'default_company_id';

    // Register Site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .insert({
        company_id,
        license_id: license.id,
        url: site_url
      })
      .select('id')
      .single();

    if (siteError) throw siteError;

    // Generate Site Token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenPrefix = rawToken.substring(0, 8);

    await supabase.from('site_tokens').insert({
      site_id: site.id,
      token_prefix: tokenPrefix,
      token_hash: tokenHash
    });

    return NextResponse.json({ 
      success: true, 
      site_token: rawToken,
      company_id
    });

  } catch (err: any) {
    console.error("License activation error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
