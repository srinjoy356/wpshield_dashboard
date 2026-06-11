import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaGraph } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'x-cron-secret, Content-Type, Authorization'
    }
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-cron-secret, Content-Type, Authorization'
};

export async function GET(request: Request) {
  const secretHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || secretHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  const admin = createAdminClient();

  // In a real scenario we'd check user preferences.
  // For demo, fetch all premium customers
  const { data: premiumSubs } = await admin
    .from('subscriptions')
    .select('customer_id')
    .eq('status', 'active');

  let sentCount = 0;

  if (premiumSubs) {
    for (const sub of premiumSubs) {
      const { data: customer } = await admin
        .from('customers')
        .select('id, owner_user_id')
        .eq('id', sub.customer_id)
        .single();
        
      if (!customer) { console.log("Cron: Customer not found for sub", sub.customer_id); continue; }
      
      const { data: profile } = await admin
        .from('user_profiles')
        .select('company_id')
        .eq('id', customer.owner_user_id)
        .single();

      if (!profile) { console.log("Cron: Profile not found for user", customer.owner_user_id); continue; }

      // Get email safely via Supabase Admin Auth
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(customer.owner_user_id);
      const email = userData?.user?.email;
      if (!email) { console.log("Cron: Email not found for user", customer.owner_user_id, "Error:", userError); continue; }
        
      const { data: sites } = await admin
        .from('sites')
        .select('url')
        .eq('company_id', profile?.company_id);

      if (!sites || sites.length === 0) { console.log("Cron: Sites empty for company", profile?.company_id); continue; }

      // Generate a consolidated report for their first site (or all sites)
      const siteUrl = sites[0].url;
      
      const dateTo = new Date().toISOString();
      const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Internally hit our generator endpoint or replicate logic. For cron, we just replicate the logic to avoid internal HTTP loopbacks.
      const { data: attacks } = await admin
        .from('wpshield_events_attack')
        .select('severity')
        .eq('company_id', profile?.company_id)
        .gte('occurred_at', dateFrom)
        .lte('occurred_at', dateTo);

      const totalAttacks = attacks?.length || 0;
      
      const htmlReport = `
        <h2>WPShield Weekly Security Report</h2>
        <p>We protected your site <strong>${siteUrl}</strong> from <strong>${totalAttacks}</strong> attacks this week.</p>
        <p>Login to your WPShield Dashboard for full details.</p>
      `;

      const success = await sendEmailViaGraph(email, `WPShield Weekly Report for ${siteUrl}`, htmlReport);
      if (!success) console.log("Cron: Graph API send failed for email", email);
      if (success) sentCount++;
    }
  }

  return NextResponse.json({ success: true, emails_sent: sentCount }, { headers: corsHeaders });
}
