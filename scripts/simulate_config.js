const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateConfig() {
  const siteId = 'cbf0567d-e027-479f-85fa-1179c7958a87';

  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single();

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('company_id', site.company_id)
    .single();

  const { data: license } = await supabase
    .from('licenses')
    .select('subscription_id')
    .eq('id', site.license_id)
    .single();

  let isPremium = false;
  if (license) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('id', license.subscription_id)
      .single();
    
    const isNotExpired = sub?.current_period_end ? new Date(sub.current_period_end) > new Date() : false;
    isPremium = sub?.status === 'active' && isNotExpired;
  }

  const config = {
    blocking_enabled: company?.blocking_enabled && isPremium,
    blocked_ips: [],
    maintenance_mode: company?.maintenance_mode && isPremium,
    away_mode_schedule: company?.away_mode_schedule && isPremium ? company.away_mode_schedule : null,
    is_premium: isPremium
  };

  console.log('Simulated API response for site:', siteId);
  console.log('Config:', config);
  console.log('Company raw:', { maintenance_mode: company.maintenance_mode, blocking: company.blocking_enabled });
}

simulateConfig().catch(console.error);
