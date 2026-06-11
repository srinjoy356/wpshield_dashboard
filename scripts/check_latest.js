const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  const { data: sites } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Latest 5 sites:', sites);

  const { data: licenses } = await supabase
    .from('licenses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Latest 5 licenses:', licenses);
}

checkAll().catch(console.error);
