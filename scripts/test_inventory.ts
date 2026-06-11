import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: snapshots, error } = await supabase
    .from('wpshield_inventory_snapshots')
    .select('*')
    .order('occurred_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching snapshots:', error);
    return;
  }
  
  console.log('Total snapshots found:', snapshots?.length);
  
  if (snapshots && snapshots.length > 0) {
    console.log('\nLatest snapshot kinds:');
    snapshots.slice(0, 5).forEach(s => {
      console.log(\- \ (Company: \, Time: \)\);
    });
  } else {
    console.log('No inventory snapshots found in the database. The inventory table is EMPTY.');
  }

  const { data: vulns, error: vulnError } = await supabase
    .from('wpshield_vuln_alerts')
    .select('*');

  console.log('\nTotal vulnerability alerts found:', vulns?.length);
}

test();