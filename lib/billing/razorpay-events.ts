import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmailViaGraph } from "@/lib/email";
import crypto from "crypto";

export async function processRazorpayEvent(event: any) {
  const supabase = createAdminClient();
  const eventId = event.id; // e.g., evt_XXX
  const eventType = event.event; // e.g., subscription.charged
  const payload = event.payload;

  // Idempotency check
  const { data: existingEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('provider_event_id', eventId)
    .maybeSingle();

  if (existingEvent) {
    console.log(`Event ${eventId} already processed.`);
    return;
  }

  await supabase.from('webhook_events').insert({
    provider: 'razorpay',
    provider_event_id: eventId,
    payload: event,
    status: 'processing'
  });

  try {
    if (eventType === 'subscription.charged') {
      const sub = payload.subscription.entity;
      const payment = payload.payment.entity;

      const { data: customer } = await supabase
        .from('customers')
        .select('id, owner_user_id')
        .eq('provider_customer_id', sub.customer_id)
        .maybeSingle();

      if (customer) {
        await supabase.from('invoices').insert({
          customer_id: customer.id,
          provider_invoice_id: payment.invoice_id || payment.id,
          amount: payment.amount,
          status: 'paid'
        });

        const { data: plan } = await supabase
          .from('plans')
          .select('id')
          .eq('price_id', sub.plan_id)
          .maybeSingle();

        if (plan) {
          const { data: subscription, error } = await supabase
            .from('subscriptions')
            .upsert({
              customer_id: customer.id,
              plan_id: plan.id,
              provider_subscription_id: sub.id,
              status: sub.status,
              current_period_end: new Date(sub.current_end * 1000).toISOString()
            }, { onConflict: 'provider_subscription_id' })
            .select('id')
            .single();

          if (error) throw error;
            
          if (subscription) {
            const { data: existingLicense } = await supabase
              .from('licenses')
              .select('id')
              .eq('subscription_id', subscription.id)
              .maybeSingle();

            if (!existingLicense) {
               const rawKey = 'wp_' + crypto.randomBytes(32).toString('hex');
               const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

               await supabase.from('licenses').insert({
                 subscription_id: subscription.id,
                 key_hash: keyHash,
                 status: 'active'
               });

               if (customer.owner_user_id) {
                 const { data: userData } = await supabase.auth.admin.getUserById(customer.owner_user_id);
                 const email = userData?.user?.email;

                 if (email) {
                   const htmlReport = `
                     <h2>Welcome to WPShield Premium</h2>
                     <p>Your subscription is active. Here is your WordPress Plugin API License Key:</p>
                     <p style="padding: 12px; background: #f4f4f4; border: 1px solid #ccc; font-family: monospace; font-size: 16px;">
                       ${rawKey}
                     </p>
                     <p><strong>Keep this key secure.</strong> You will need to enter it in your WordPress dashboard.</p>
                   `;
                   await sendEmailViaGraph(email, "Your WPShield License Key", htmlReport);
                 }
               }
            }
          }
        }
      }
    } else if (eventType === 'subscription.halted' || eventType === 'subscription.cancelled') {
      const sub = payload.subscription.entity;
      await supabase
        .from('subscriptions')
        .update({ status: sub.status })
        .eq('provider_subscription_id', sub.id);
    } else if (eventType === 'subscription.activated') {
      const sub = payload.subscription.entity;
      await supabase
        .from('subscriptions')
        .update({ status: sub.status })
        .eq('provider_subscription_id', sub.id);
    }

    await supabase.from('webhook_events')
      .update({ status: 'completed' })
      .eq('provider_event_id', eventId);

  } catch (err: any) {
    console.error("Webhook processing error", err);
    await supabase.from('webhook_events')
      .update({ status: 'failed', payload: { ...event, error: err.message } })
      .eq('provider_event_id', eventId);
    throw err;
  }
}
