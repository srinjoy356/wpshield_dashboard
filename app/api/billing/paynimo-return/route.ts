import { NextResponse } from 'next/server';
import { Paynimo } from '@/lib/billing/paynimo';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaGraph } from '@/lib/email';
import { encryptLicenseKey } from '@/lib/security/license-crypto';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const host     = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl  = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${protocol}://${host}`
  ).replace(/\/$/, '');

  const supabase = createAdminClient();
  // Tracks the webhook_events row id for this request, set once logged below,
  // so the catch block can still update it to 'failed' even if something
  // throws deep in the provisioning logic.
  let webhookEventId: string | null = null;

  try {
    const formData = await request.formData();
    const msg = formData.get('msg') as string;

    if (!msg) return NextResponse.redirect(`${baseUrl}/app/billing?error=no_response`, 303);

    const parts      = msg.split('|');
    const authStatus = parts[0];
    const txnRefNo   = parts[3];
    const tpslTxnId  = parts[5];
    const txnAmt     = parts[6];

    // RG-07: log the raw provider payload immediately, before any processing —
    // so there's a permanent record of exactly what Paynimo sent even if hash
    // verification fails, the txn_ref doesn't match anything, or provisioning
    // throws partway through. Upsert on (provider, provider_event_id) so a
    // genuine retry of the same callback updates this row instead of erroring
    // on the unique constraint.
    const { data: webhookEvent } = await supabase
      .from('webhook_events')
      .upsert({
        provider: 'paynimo',
        provider_event_id: tpslTxnId || txnRefNo || `unref_${Date.now()}`,
        payload: { msg, authStatus, txnRefNo, tpslTxnId, txnAmt },
        status: 'received',
      }, { onConflict: 'provider,provider_event_id' })
      .select('id')
      .single();
    webhookEventId = webhookEvent?.id ?? null;

    // 1. Verify Paynimo hash
    if (!Paynimo.verifyResponseHash(msg)) {
      console.error('[Paynimo Return] Hash verification failed');
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'failed' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?error=hash_mismatch`, 303);
    }

    if (authStatus !== '0300') {
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'failed' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?error=payment_failed`, 303);
    }

    // 2. Replay protection — if this exact provider transaction already completed, redirect
    //    idempotently instead of re-running provisioning. Must check BEFORE the atomic claim
    //    below, because a completed checkout no longer matches that claim's WHERE clause anyway —
    //    this just gives a clean "already done" response instead of falling through to the
    //    generic "still processing" branch.
    if (tpslTxnId) {
      const { data: dup } = await supabase
        .from('pending_checkouts')
        .select('id, status')
        .eq('provider_txn_id', tpslTxnId)
        .maybeSingle();

      if (dup?.status === 'completed') {
        return NextResponse.redirect(`${baseUrl}/app/billing?success=1`, 303);
      }
    }

    // 3. RG-09: atomic claim. This single UPDATE...WHERE status='pending'...RETURNING is the
    //    entire concurrency fix — it replaces the old SELECT-then-UPDATE sequence, which had a
    //    window where two near-simultaneous callbacks for the same txn_ref could both read
    //    status='pending', both decide they're the one to provision, and both proceed to insert
    //    a subscription/license. Postgres guarantees only one concurrent UPDATE can actually
    //    flip a given row's status from 'pending' to 'processing'; whichever request loses the
    //    race gets zero rows back from this call and must NOT proceed with provisioning.
    const { data: claimed } = await supabase
      .from('pending_checkouts')
      .update({ status: 'processing', provider_txn_id: tpslTxnId || null })
      .eq('txn_ref', txnRefNo)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    let pending = claimed;

    if (!pending) {
      // Didn't win the claim — check current status to decide how to respond,
      // rather than assuming failure. Another concurrent request (or an earlier
      // completed run of this exact txn_ref) may already have finished.
      const { data: current } = await supabase
        .from('pending_checkouts')
        .select('status')
        .eq('txn_ref', txnRefNo)
        .maybeSingle();

      if (current?.status === 'completed') {
        return NextResponse.redirect(`${baseUrl}/app/billing?success=1`, 303);
      }
      if (!current) {
        console.error('[Paynimo Return] No matching pending checkout for txn_ref:', txnRefNo);
        if (webhookEventId) {
          await supabase.from('webhook_events').update({ status: 'failed' }).eq('id', webhookEventId);
        }
        return NextResponse.redirect(`${baseUrl}/app/billing?error=invalid_txn`, 303);
      }
      // Status is 'processing' (lost the race to a concurrent request) or some
      // other non-completed state — don't provision a second time. The request
      // that won the claim is already handling it.
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'received' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?info=processing`, 303);
    }

    // 4. Verify amount matches exactly what we expected — no partial-payment acceptance.
    //    Runs AFTER the claim now (rather than before), since only the request that actually
    //    won the atomic claim above reaches this point — no race to worry about here.
    const paidAmountInr = Math.round(parseFloat(txnAmt));
    if (paidAmountInr !== pending.expected_amount_inr) {
      console.error(`[Paynimo Return] Amount mismatch: expected ${pending.expected_amount_inr}, got ${paidAmountInr}`);
      await supabase.from('pending_checkouts').update({ status: 'amount_mismatch' }).eq('id', pending.id);
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'failed' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?error=amount_mismatch`, 303);
    }

    // 5. Check expiry
    if (new Date(pending.expires_at) < new Date()) {
      await supabase.from('pending_checkouts').update({ status: 'expired' }).eq('id', pending.id);
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'failed' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?error=expired`, 303);
    }

    const userId = pending.user_id;
    const planId = pending.plan_id;

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

    // 8. Plan switch — if the customer has an active subscription on a DIFFERENT plan,
    //    supersede it.
    const { data: otherActiveSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('customer_id', customer.id)
      .neq('plan_id', planId)
      .eq('status', 'active');

    if (otherActiveSubs && otherActiveSubs.length > 0) {
      const otherSubIds = otherActiveSubs.map((s) => s.id);
      await supabase.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).in('id', otherSubIds);
      await supabase.from('licenses').update({ status: 'cancelled' }).in('subscription_id', otherSubIds);
    }

    // 9. Check if customer already has an active subscription for this plan (RENEWAL)
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, current_period_end')
      .eq('customer_id', customer.id)
      .eq('plan_id', planId)
      .in('status', ['active', 'expired', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let subscriptionId: string;
    let isRenewal = false;

    if (existingSub) {
      isRenewal = true;
      const currentEnd = new Date(existingSub.current_period_end);
      const base = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

      await supabase.from('subscriptions').update({
        status: 'active',
        current_period_end: newEnd.toISOString(),
        grace_period_ends_at: null,
        dunning_attempts: 0,
      }).eq('id', existingSub.id);

      subscriptionId = existingSub.id;

      await supabase.from('licenses').update({ status: 'active' })
        .eq('subscription_id', subscriptionId);

    } else {
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

    // 10. Create invoice — upsert on provider_invoice_id so a retried/duplicate POST can't
    //     create two invoice rows for the same payment.
    const invoiceNumber = await nextInvoiceNumber(supabase);
    await supabase.from('invoices').upsert({
      customer_id: customer.id,
      provider_invoice_id: tpslTxnId || txnRefNo,
      amount: Math.round(parseFloat(txnAmt) * 100),
      status: 'paid',
      invoice_number: invoiceNumber,
      currency: 'INR',
      gstin: process.env.COMPANY_GSTIN || null,
      tax_rate: process.env.DEFAULT_TAX_RATE ? parseFloat(process.env.DEFAULT_TAX_RATE) : null,
    }, { onConflict: 'provider_invoice_id' });

    // 11. Get or create license key. RG-01: the raw key now gets encrypted and stored
    //     alongside the hash — delivery_status starts 'pending' and is updated below based on
    //     the actual email outcome, so even if the email fails, the key isn't lost: it's sitting
    //     encrypted in the DB and delivery_status:'failed' makes the failure visible to admins
    //     instead of disappearing silently.
    let rawKey: string | null = null;
    let newLicenseId: string | null = null;
    const { data: existingLicense } = await supabase
      .from('licenses')
      .select('id, key_hash')
      .eq('subscription_id', subscriptionId)
      .maybeSingle();

    if (!existingLicense) {
      rawKey = 'wp_' + crypto.randomBytes(32).toString('hex');
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const encryptedKey = encryptLicenseKey(rawKey);
      const { data: insertedLicense } = await supabase.from('licenses').insert({
        subscription_id: subscriptionId,
        key_hash: keyHash,
        encrypted_key: encryptedKey,
        status: 'active',
        max_sites: plan.max_sites,
        delivery_status: 'pending',
      }).select('id').single();
      newLicenseId = insertedLicense?.id ?? null;
    }
    // On renewal rawKey stays null — we don't re-send the key, just confirm renewal

    // 12. Send email — outcome now actually recorded, not just logged to console and forgotten.
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    let emailSucceeded = true;

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

      try {
        emailSucceeded = await sendEmailViaGraph(email, subject, html);
      } catch (emailErr: any) {
        console.error('[Paynimo Return] Email send threw:', emailErr.message);
        emailSucceeded = false;
      }
    } else {
      emailSucceeded = false;
    }

    if (newLicenseId) {
      await supabase.from('licenses').update({
        delivery_status: emailSucceeded ? 'sent' : 'failed',
        delivery_error: emailSucceeded ? null : 'Email send failed or no email on file — key is recoverable via admin reveal.',
        last_delivery_attempt_at: new Date().toISOString(),
      }).eq('id', newLicenseId);
    }

    // 13. Only now — after every provisioning step has succeeded — mark the checkout completed.
    await supabase.from('pending_checkouts').update({ status: 'completed' }).eq('id', pending.id);

    if (webhookEventId) {
      await supabase.from('webhook_events').update({ status: 'completed' }).eq('id', webhookEventId);
    }

    return NextResponse.redirect(`${baseUrl}/app/billing?success=1`, 303);

  } catch (err: any) {
    console.error('[Paynimo Return]', err.message);
    if (webhookEventId) {
      await supabase.from('webhook_events').update({ status: 'failed' }).eq('id', webhookEventId).then(() => {}, () => {});
    }
    return NextResponse.redirect(`${baseUrl}/app/billing?error=server_error`, 303);
  }
}

// RG-10: sequential invoice numbering via a real Postgres sequence (not row
// count or array length, which breaks under concurrent inserts or deletions).
// Format: WPS-<year>-<6-digit padded sequence>.
async function nextInvoiceNumber(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data, error } = await supabase.rpc('next_invoice_number');
  if (error || data == null) {
    // Fallback: should not normally happen (the RPC function is created by
    // migration 023's companion function below), but never let invoice
    // numbering itself block a payment from completing.
    console.error('[nextInvoiceNumber] RPC failed, falling back to timestamp-based number:', error?.message);
    return `WPS-${new Date().getFullYear()}-${Date.now()}`;
  }
  const year = new Date().getFullYear();
  return `WPS-${year}-${String(data).padStart(6, '0')}`;
}