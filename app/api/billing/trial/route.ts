import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { customer_email, user_id } = await request.json();
    const supabase = createAdminClient();

    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('owner_user_id', user_id)
      .maybeSingle();

    if (!customer) {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          owner_user_id: user_id,
          email: customer_email,
        })
        .select('id')
        .single();
        
      if (error) throw error;
      customer = newCustomer;
    }

    const { data: plan } = await supabase
      .from('plans')
      .select('id')
      .eq('id', 'trial')
      .maybeSingle();

    // If trial plan not in DB, fallback gracefully or error
    if (!plan) return NextResponse.json({ error: 'Trial plan not configured in DB' }, { status: 404 });

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert({
        customer_id: customer.id,
        plan_id: plan.id,
        provider_subscription_id: `trial_${crypto.randomUUID()}`,
        status: 'active',
        current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select('id')
      .single();

    if (error) throw error;

    await supabase.from('licenses').insert({
      subscription_id: subscription.id,
      key_hash: crypto.randomUUID(),
      status: 'active'
    });

    return NextResponse.json({ success: true, message: 'Trial activated' });
  } catch (err: any) {
    console.error("Trial error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
