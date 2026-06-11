const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, url, license_id');
  console.log("Sites:", data);
}

checkSites();
