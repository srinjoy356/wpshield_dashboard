require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: tokenData } = await supabase.from('site_tokens').select('site_id, token_hash').order('created_at', { ascending: false }).limit(1);
  if(!tokenData || tokenData.length === 0) return console.log('no tokens');
  
  const token = tokenData[0].token_hash;
  const siteId = tokenData[0].site_id;
  
  const { data: site } = await supabase.from('sites').select('url').eq('id', siteId).single();
  
  console.log('Site URL:', site.url);
  console.log('Token:', token);

  const targetUrl = `${site.url}/wp-json/wpshield/v1/remediate`;
  
  console.log('Sending request to:', targetUrl);
  
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ action: 'update_plugin', plugin_slug: 'akismet/akismet.php' }) // guessing akismet exists or some other plugin
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}

test();
