import { NextResponse } from 'next/server';
import { Paynimo } from '@/lib/billing/paynimo';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaGraph } from '@/lib/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  try {
    const formData = await request.formData();
    const msg = formData.get('msg') as string;

    if (!msg) return NextResponse.redirect(`${baseUrl}/app/billing?error=no_response`, 303);

    // 1. Verify Paynimo hash
    if (!Paynimo.verifyResponseHash(msg)) {
      console.error('[Paynimo Return] Hash verification failed');
      return NextResponse.redirect(`${baseUrl}/app/billing?error=hash_mismatch`, 303);
    }

    const parts     = msg.split('|');
    const authStatus = parts[0];
    const txnRefNo   = parts[3];
    const tpslTxnId  = parts[5];
    const txnAmt     = parts[6];

    if (authStatus !== '0300') {
      return NextResponse.redirect(`${baseUrl}/app/billing?error=payment_failed`, 303);
    }

    const supabase = createAdminClient();

    // 2. Look up pending_checkout by txn_ref — NOT URL params
    const { data: pending, error: pendingErr } = await supabase
      .from('pending_checkouts')
      .select('*')
      .eq('txn_ref', txnRefNo)
      .eq('status', 'pending')
      .single();

    if (pendingErr || !pending) {
      console.error('[Paynimo Return] No matching pending checkout for txn_ref:', txnRefNo);
      return NextResponse.redirect(`${baseUrl}/app/billing?error=invalid_txn`, 303);
    }

    // 3. Verify amount matches what we expected
    const paidAmountInr = Math.round(parseFloat(txnAmt));
    if (paidAmountInr < pending.expected_amount_inr) {
      console.error(`[Paynimo Return] Amount mismatch: expected ${pending.expected_amount_inr}, got ${paidAmountInr}`);
      await supabase.from('pending_checkouts').update({ status: 'amount_mismatch' }).eq('id', pending.id);
      return NextResponse.redirect(`${baseUrl}/app/billing?error=amount_mismatch`, 303);
    }

    // 4. Check expiry
    if (new Date(pending.expires_at) < new Date()) {
      await supabase.from('pending_checkouts').update({ status: 'expired' }).eq('id', pending.id);
      return NextResponse.redirect(`${baseUrl}/app/billing?error=expired`, 303);
    }

    // 5. Mark pending checkout as completed
    await supabase.from('pending_checkouts').update({ status: 'completed' }).eq('id', pending.id);

    const userId  = pending.user_id;
    const planId  = pending.plan_id;

    // 6. Get plan details including max_sites
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, max_sites')
      .eq('id', planId)
      .single();

    if (!plan) throw new Error('Plan not found');

    // 7. Ensure customer exists
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (!customer) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email;
      if (!userEmail) throw new Error('Could not find user email');
      const { data: newCust, error } = await supabase.from('customers').insert({
        owner_user_id: userId,
        email: userEmail,
        provider_customer_id: `paynimo_cust_${userId}`,
      }).select('id').single();
      if (error) throw error;
      customer = newCust;
    }

    // 8. Check if customer already has an active subscription for this plan (RENEWAL)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, current_period_end')
      .eq('customer_id', customer.id)
      .eq('plan_id', planId)
      .in('status', ['active', 'expired'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let subscriptionId: string;
    let isRenewal = false;

    if (existingSub) {
      // RENEWAL — extend current_period_end, reactivate if expired
      isRenewal = true;
      const currentEnd = new Date(existingSub.current_period_end);
      const base = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

      await supabase.from('subscriptions').update({
        status: 'active',
        current_period_end: newEnd.toISOString(),
      }).eq('id', existingSub.id);

      subscriptionId = existingSub.id;

      // Reactivate the existing license
      await supabase.from('licenses').update({ status: 'active' })
        .eq('subscription_id', subscriptionId);

    } else {
      // NEW subscription
      const { data: newSub, error: subErr } = await supabase
        .from('subscriptions')
        .insert({
          customer_id: customer.id,
          plan_id: planId,
          provider_subscription_id: `sub_paynimo_${txnRefNo}`,
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }).select('id').single();
      if (subErr) throw subErr;
      subscriptionId = newSub.id;
    }

    // 9. Create invoice
    await supabase.from('invoices').insert({
      customer_id: customer.id,
      provider_invoice_id: tpslTxnId || txnRefNo,
      amount: Math.round(parseFloat(txnAmt) * 100),
      status: 'paid',
    });

    // 10. Get or create license key
    let rawKey: string | null = null;
    const { data: existingLicense } = await supabase
      .from('licenses')
      .select('id, key_hash')
      .eq('subscription_id', subscriptionId)
      .maybeSingle();

    if (!existingLicense) {
      // New license
      rawKey = 'wp_' + crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      await supabase.from('licenses').insert({
        subscription_id: subscriptionId,
        key_hash: keyHash,
        status: 'active',
        max_sites: plan.max_sites,
      });
    }
    // On renewal rawKey stays null — we don't re-send the key, just confirm renewal

    // 11. Send email
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (email) {
      const subject = isRenewal
        ? 'WPShield Subscription Renewed'
        : 'Your WPShield License Key';

      const html = isRenewal
        ? `<h2>Your WPShield subscription has been renewed.</h2>
           <p>Plan: <strong>${plan.name}</strong></p>
           <p>Your existing license key remains active. You do not need to make any changes in WordPress.</p>`
        : `<h2>Welcome to WPShield!</h2>
           <p>Your payment of INR ${txnAmt} was successful.</p>
           <p>Plan: <strong>${plan.name}</strong> — ${plan.max_sites} site${plan.max_sites > 1 ? 's' : ''}</p>
           <p>Your license key:</p>
           <p style="padding:12px;background:#f4f4f4;border:1px solid #ccc;font-family:monospace;font-size:16px;">${rawKey}</p>
           <p><strong>Keep this key secure.</strong> Enter it in your WordPress WPShield settings.</p>`;

      console.log(`[EMAIL TO: ${email}]`, subject);
      await sendEmailViaGraph(email, subject, html);
    }

    return NextResponse.redirect(`${baseUrl}/app/billing?success=1`, 303);

  } catch (err: any) {
    console.error('[Paynimo Return]', err.message);
    return NextResponse.redirect(`${baseUrl}/app/billing?error=server_error`, 303);
  }
}