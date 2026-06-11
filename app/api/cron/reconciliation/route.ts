import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secretHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || secretHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: expiredSubs } = await supabase
    .from('subscriptions')
    .select('id, provider_subscription_id')
    .eq('status', 'active')
    .lt('current_period_end', new Date().toISOString());

  let reconciledCount = 0;

  if (expiredSubs && expiredSubs.length > 0) {
    for (const sub of expiredSubs) {
      if (sub.provider_subscription_id.startsWith('trial_')) {
        await supabase.from('subscriptions')
          .update({ status: 'halted' })
          .eq('id', sub.id);
        reconciledCount++;
      } else {
        // Here we could add logic to ping Razorpay API to check subscription status
        // and update DB if webhooks were missed.
      }
    }
  }

  return NextResponse.json({ success: true, reconciled: reconciledCount });
}
