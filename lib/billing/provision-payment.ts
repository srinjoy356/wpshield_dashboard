/**
 * provision-payment.ts
 *
 * Shared payment provisioning service used by both:
 *   - app/api/billing/paynimo-return/route.ts  (real-time callback)
 *   - app/api/cron/reconciliation/route.ts     (recovery for stuck checkouts)
 *
 * Idempotent: safe to call multiple times for the same checkout without
 * creating duplicate subscriptions, licenses, or invoices. Keyed on checkout id.
 *
 * State machine:
 *   pending / needs_manual_provisioning
 *     → (atomic UPDATE) → processing
 *     → (on success)    → completed
 *     → (on failure)    → failed / needs_review
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaGraph } from '@/lib/email';
import { encryptLicenseKey } from '@/lib/security/license-crypto';
import crypto from 'crypto';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface ProvisionResult {
  success: boolean;
  alreadyProvisioned?: boolean;
  subscriptionId?: string;
  licenseId?: string;
  error?: string;
}

/**
 * Provision a completed payment: create/renew subscription, issue license,
 * create invoice, send license key email.
 *
 * @param supabase    Admin Supabase client
 * @param checkoutId  The pending_checkouts.id row to provision
 * @param providerTxnId  Paynimo's bankReferenceId / tpslTxnId
 * @param txnAmtStr   Amount string from provider (e.g. "5.00")
 * @param baseUrl     App base URL for email links
 */
export async function provisionPayment(
  supabase: SupabaseAdmin,
  checkoutId: string,
  providerTxnId: string,
  txnAmtStr: string,
  baseUrl: string,
): Promise<ProvisionResult> {

  // ── 1. Load checkout ──────────────────────────────────────────────────────
  const { data: checkout } = await supabase
    .from('pending_checkouts')
    .select('*')
    .eq('id', checkoutId)
    .maybeSingle();

  if (!checkout) {
    return { success: false, error: `Checkout ${checkoutId} not found` };
  }

  // ── 2. Idempotency: already completed ────────────────────────────────────
  if (checkout.status === 'completed') {
    return { success: true, alreadyProvisioned: true };
  }

  // ── 3. Amount verification ────────────────────────────────────────────────
  const txnAmt = parseFloat(txnAmtStr);
  if (isNaN(txnAmt) || Math.abs(txnAmt - checkout.expected_amount_inr) > 0.5) {
    await supabase
      .from('pending_checkouts')
      .update({ status: 'amount_mismatch' })
      .eq('id', checkoutId);
    return {
      success: false,
      error: `Amount mismatch: expected ₹${checkout.expected_amount_inr}, got ₹${txnAmt}`,
    };
  }

  // ── 4. Atomic claim ───────────────────────────────────────────────────────
  // Accepts 'pending' (real-time path) and 'needs_manual_provisioning'
  // (reconciliation path). Only one concurrent caller wins.
  const { data: claimed } = await supabase
    .from('pending_checkouts')
    .update({ status: 'processing', provider_txn_id: providerTxnId || null })
    .in('status', ['pending', 'needs_manual_provisioning'])
    .eq('id', checkoutId)
    .select('*')
    .maybeSingle();

  if (!claimed) {
    // Another caller already has the lock, or it's already completed
    const { data: current } = await supabase
      .from('pending_checkouts')
      .select('status')
      .eq('id', checkoutId)
      .maybeSingle();

    if (current?.status === 'completed') {
      return { success: true, alreadyProvisioned: true };
    }
    return {
      success: false,
      error: `Could not claim checkout ${checkoutId} — status is '${current?.status ?? 'unknown'}'`,
    };
  }

  const pending   = claimed;
  const userId    = pending.user_id;
  const planId    = pending.plan_id;
  const txnRefNo  = pending.txn_ref;

  try {
    // ── 5. Expiry check ───────────────────────────────────────────────────
    if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
      // Paynimo confirmed the payment; if our checkout record is past our
      // soft expiry, we still provision — the customer paid. Just log it.
      console.warn(`[provision] Checkout ${checkoutId} expired at ${pending.expires_at} but payment was confirmed — provisioning anyway.`);
    }

    // ── 6. Get plan ───────────────────────────────────────────────────────
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, max_sites')
      .eq('id', planId)
      .single();

    if (!plan) throw new Error('Plan not found');

    // ── 7. Ensure customer exists ─────────────────────────────────────────
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (!customer) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email;
      if (!userEmail) throw new Error('Could not find user email for customer creation');
      const { data: newCust, error } = await supabase
        .from('customers')
        .insert({
          owner_user_id: userId,
          email: userEmail,
          provider_customer_id: `paynimo_cust_${userId}`,
        })
        .select('id')
        .single();
      if (error) throw error;
      customer = newCust;
    }

    // ── 8. Cancel other active plans (plan switch) ────────────────────────
    const { data: otherActiveSubs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('customer_id', customer.id)
      .neq('plan_id', planId)
      .eq('status', 'active');

    if (otherActiveSubs && otherActiveSubs.length > 0) {
      const otherSubIds = otherActiveSubs.map((s) => s.id);
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .in('id', otherSubIds);
      await supabase
        .from('licenses')
        .update({ status: 'cancelled' })
        .in('subscription_id', otherSubIds);
    }

    // ── 9. Create or renew subscription ───────────────────────────────────
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

      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_end: newEnd.toISOString(),
          grace_period_ends_at: null,
          dunning_attempts: 0,
        })
        .eq('id', existingSub.id);

      subscriptionId = existingSub.id;

      await supabase
        .from('licenses')
        .update({ status: 'active' })
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
        })
        .select('id')
        .single();
      if (subErr) throw subErr;
      subscriptionId = newSub.id;
    }

    // ── 10. Create invoice (idempotent on provider_invoice_id) ────────────
    const invoiceNumber = await nextInvoiceNumber(supabase);
    await supabase
      .from('invoices')
      .upsert({
        customer_id: customer.id,
        provider_invoice_id: providerTxnId || txnRefNo,
        amount: Math.round(txnAmt * 100),
        status: 'paid',
        invoice_number: invoiceNumber,
        currency: 'INR',
        gstin: process.env.COMPANY_GSTIN || null,
        tax_rate: process.env.DEFAULT_TAX_RATE ? parseFloat(process.env.DEFAULT_TAX_RATE) : null,
      }, { onConflict: 'provider_invoice_id' });

    // ── 11. Issue license key (escrow: AES-256-GCM) ───────────────────────
    let rawKey: string | null = null;
    let newLicenseId: string | null = null;

    const { data: existingLicense } = await supabase
      .from('licenses')
      .select('id, key_hash')
      .eq('subscription_id', subscriptionId)
      .maybeSingle();

    if (!existingLicense) {
      rawKey = 'wp_' + crypto.randomBytes(32).toString('hex');
      const keyHash      = crypto.createHash('sha256').update(rawKey).digest('hex');
      const encryptedKey = encryptLicenseKey(rawKey);

      const { data: insertedLicense } = await supabase
        .from('licenses')
        .insert({
          subscription_id: subscriptionId,
          key_hash:        keyHash,
          encrypted_key:   encryptedKey,
          status:          'active',
          max_sites:       plan.max_sites,
          delivery_status: 'pending',
        })
        .select('id')
        .single();
      newLicenseId = insertedLicense?.id ?? null;
    }

    // ── 12. Send email ────────────────────────────────────────────────────
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
           <p>Your payment of ₹${txnAmt} was successful.</p>
           <p>Plan: <strong>${plan.name}</strong> — ${plan.max_sites} site${plan.max_sites > 1 ? 's' : ''}</p>
           <p>Your license key:</p>
           <p style="padding:12px;background:#f4f4f4;border:1px solid #ccc;font-family:monospace;font-size:16px;">${rawKey}</p>
           <p><strong>Keep this key secure.</strong> Enter it in your WordPress WPShield settings.</p>
           <p style="margin-top:24px;font-size:13px;color:#6b7280;">
             If you ever lose this key, an administrator can resend it from the WPShield admin panel.
           </p>`;

      try {
        emailSucceeded = await sendEmailViaGraph(email, subject, html);
      } catch (emailErr: any) {
        console.error('[provision] Email send threw:', emailErr.message);
        emailSucceeded = false;
      }
    } else {
      emailSucceeded = false;
    }

    if (newLicenseId) {
      await supabase
        .from('licenses')
        .update({
          delivery_status: emailSucceeded ? 'sent' : 'failed',
          delivery_error: emailSucceeded
            ? null
            : 'Email send failed or no email on file — key is recoverable via admin reveal.',
          last_delivery_attempt_at: new Date().toISOString(),
        })
        .eq('id', newLicenseId);
    }

    // ── 13. Mark checkout completed ───────────────────────────────────────
    await supabase
      .from('pending_checkouts')
      .update({ status: 'completed' })
      .eq('id', checkoutId);

    return {
      success: true,
      subscriptionId,
      licenseId: newLicenseId ?? existingLicense?.id,
    };

  } catch (err: any) {
    console.error('[provision] Error:', err.message);
    await supabase
      .from('pending_checkouts')
      .update({ status: 'needs_review' })
      .eq('id', checkoutId);
    return { success: false, error: err.message };
  }
}

// Sequential invoice numbering via Postgres sequence (migration 023).
async function nextInvoiceNumber(supabase: SupabaseAdmin): Promise<string> {
  const { data, error } = await supabase.rpc('next_invoice_number');
  if (error || data == null) {
    console.error('[nextInvoiceNumber] RPC failed, using timestamp fallback:', error?.message);
    return `WPS-${new Date().getFullYear()}-${Date.now()}`;
  }
  const year = new Date().getFullYear();
  return `WPS-${year}-${String(data).padStart(6, '0')}`;
}