const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetails() {
  const { data: license } = await supabase
    .from('licenses')
    .select('*')
    .eq('id', 'a328e9f9-7d90-4a91-9eb3-4040922ae910')
    .single();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', license.subscription_id)
    .single();

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', sub.customer_id)
    .single();

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', customer.owner_user_id)
    .single();

  console.log('User Profile:', userProfile);

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('company_id', userProfile.company_id)
    .single();

  console.log('Company:', company);
}

checkDetails().catch(console.error);
