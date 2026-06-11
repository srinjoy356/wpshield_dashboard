const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
  const company_id = 'srinjoy356';

  const { data: company } = await supabase
    .from('companies')
    .select('maintenance_mode')
    .eq('company_id', company_id)
    .single();

  console.log('Company (srinjoy356):', company);

  const { data: sites } = await supabase
    .from('sites')
    .select('*')
    .eq('company_id', company_id);
    
  console.log('Sites:', sites);

  if (sites && sites.length > 0) {
    for (const site of sites) {
        if (!site.license_id) {
            console.log(`Site ${site.url} has NO license`);
            continue;
        }
        const { data: license } = await supabase
          .from('licenses')
          .select('subscription_id, status')
          .eq('id', site.license_id)
          .single();
        console.log(`License for site ${site.url}:`, license);

        if (license) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('status, current_period_end')
            .eq('id', license.subscription_id)
            .single();
          console.log(`Sub for site ${site.url}:`, sub);
        }
    }
  }
}

checkState().catch(console.error);
