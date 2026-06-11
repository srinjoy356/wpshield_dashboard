const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const license_key = 'wp_bcc9d0a53207b09817940bda9b0d7c4af5e518210fbc30177dd567fe4987e773';
  const site_url = 'http://localhost';

  const trimmedKey = license_key.trim();
  const providedHash = crypto.createHash('sha256').update(trimmedKey).digest('hex');
  console.log(`Hash: ${providedHash}`);

  const { data: license, error: fetchError } = await supabase
    .from('licenses')
    .select('id, subscription_id, status')
    .eq('key_hash', providedHash)
    .maybeSingle();

  console.log('License DB Result:', { license, fetchError });

  if (fetchError || !license || license.status !== 'active') {
    console.log("Failed at license check");
    return;
  }

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('customer_id, plan_id')
    .eq('id', license.subscription_id)
    .single();
    
  console.log('Subscription:', { sub, subErr });

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('owner_user_id')
    .eq('id', sub?.customer_id)
    .single();
    
  console.log('Customer:', { customer, custErr });

  const { data: userProfile, error: upErr } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', customer?.owner_user_id)
    .maybeSingle();

  console.log('User Profile:', { userProfile, upErr });

  const company_id = userProfile?.company_id || 'default_company_id';

  console.log(`Inserting site with company_id: ${company_id}`);

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .insert({
      company_id,
      license_id: license.id,
      url: site_url
    })
    .select('id')
    .single();

  console.log('Site Error:', siteError);
  console.log('Site Data:', site);
}

main().catch(console.error);
