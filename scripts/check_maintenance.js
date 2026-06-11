const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const company_id = 'test_WP';

  const { data: company, error } = await supabase
    .from('companies')
    .select('maintenance_mode')
    .eq('company_id', company_id)
    .single();

  console.log('Company:', company);
  console.log('Error:', error);
}

checkConfig();
