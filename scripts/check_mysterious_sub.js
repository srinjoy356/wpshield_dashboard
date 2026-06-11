const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSub() {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', 'fe1a33ee-f83d-4c2d-9bd8-b3f57220777b')
    .single();

  console.log('Sub:', sub);
  
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', sub.customer_id)
    .single();
    
  console.log('Customer:', customer);
  
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', customer.owner_user_id)
    .single();
    
  console.log('UserProfile:', userProfile);
}

checkSub().catch(console.error);
