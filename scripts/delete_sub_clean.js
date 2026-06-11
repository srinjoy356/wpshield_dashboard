const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const targetEmail = 'aritra@cybernara.com';

  console.log(`Looking up customer with email: ${targetEmail}`);

  // 1. Get customer
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('id, email')
    .ilike('email', targetEmail);

  if (cErr) {
    console.error("Error fetching customer:", cErr);
    return;
  }

  if (!customers || customers.length === 0) {
    console.log("No customer found with that email.");
    return;
  }

  const customerId = customers[0].id;
  console.log(`Found customer ID: ${customerId}`);

  // 2. Get subscriptions
  const { data: subs, error: sErr } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('customer_id', customerId);

  if (sErr) {
    console.error("Error fetching subscriptions:", sErr);
    return;
  }

  if (!subs || subs.length === 0) {
    console.log("No subscriptions found.");
    return;
  }

  for (const sub of subs) {
    // 3. Nullify license_id in sites referencing these licenses
    const { data: licenses } = await supabase
      .from('licenses')
      .select('id')
      .eq('subscription_id', sub.id);

    if (licenses && licenses.length > 0) {
      for (const lic of licenses) {
        console.log(`Nullifying license_id for sites using license: ${lic.id}`);
        await supabase
          .from('sites')
          .update({ license_id: null })
          .eq('license_id', lic.id);
      }
    }

    console.log(`Deleting licenses for subscription: ${sub.id}`);
    const { error: lErr } = await supabase
      .from('licenses')
      .delete()
      .eq('subscription_id', sub.id);
    
    if (lErr) console.error("Error deleting licenses:", lErr);
    else console.log("Licenses deleted successfully.");

    console.log(`Deleting subscription: ${sub.id}`);
    const { error: delSubErr } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', sub.id);

    if (delSubErr) console.error("Error deleting subscription:", delSubErr);
    else console.log("Subscription deleted successfully.");
  }
}

main().catch(console.error);
