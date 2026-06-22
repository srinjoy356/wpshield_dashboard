import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Paynimo } from '@/lib/billing/paynimo';
import { provisionPayment } from '@/lib/billing/provision-payment';

export const dynamic = 'force-dynamic';

const STUCK_THRESHOLD_MINUTES = 30;
const DUNNING_MAX_ATTEMPTS    = 3;
const GRACE_PERIOD_DAYS       = 5;

export async function GET(request: Request) {
  const secretHeader = request.headers.get("x-cron-secret");
  const cronSecret   = process.env.CRON_SECRET;

  if (!cronSecret || secretHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl  = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://wpshield-dashboard.onrender.com'
  ).replace(/\/$/, '');

  const results = {
    stuckCheckoutsChecked:    0,
    stuckCheckoutsRecovered:  0,
    stuckCheckoutsStillPending: 0,
    expiredSubsReconciled:    0,
    subsEnteredGracePeriod:   0,
    subsExpiredAfterGrace:    0,
  };

  // ── Part 1: recover stuck checkouts ──────────────────────────────────────
  // A checkout is "stuck" if it's been pending/processing for > 30 min, which
  // means the customer's browser likely never delivered the return POST even
  // though Paynimo may have completed the payment on their end.
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

  const { data: stuckCheckouts } = await supabase
    .from('pending_checkouts')
    .select('*')
    .in('status', ['pending', 'processing', 'needs_manual_provisioning'])
    .lt('created_at', stuckThreshold);

  for (const checkout of stuckCheckouts || []) {
    results.stuckCheckoutsChecked++;

    // Ask Paynimo what actually happened with this transaction
    const status = await Paynimo.checkTransactionStatus(
      checkout.txn_ref,
      new Date(checkout.created_at),
    );

    // Audit every reconciliation lookup — same as RG-07 for real-time callbacks
    await supabase
      .from('webhook_events')
      .upsert({
        provider: 'paynimo',
        provider_event_id: `reconcile_${checkout.txn_ref}_${Date.now()}`,
        payload: {
          source: 'reconciliation_cron',
          checkout_id: checkout.id,
          txn_ref: checkout.txn_ref,
          status,
        },
        status: status ? 'received' : 'failed',
      }, { onConflict: 'provider,provider_event_id' });

    if (!status) {
      // Couldn't reach Paynimo — leave as-is, try again next cron run
      results.stuckCheckoutsStillPending++;
      continue;
    }

    if (status.statusCode === '0300') {
      // Paynimo confirms payment succeeded but we never provisioned it.
      // Auto-provision using the shared service (RG Gap 2 fix).
      const result = await provisionPayment(
        supabase,
        checkout.id,
        status.bankReferenceId || checkout.provider_txn_id || '',
        status.amount || checkout.expected_amount_inr.toString(),
        baseUrl,
      );

      if (result.success) {
        results.stuckCheckoutsRecovered++;
        console.log(`[Reconciliation] Auto-provisioned ${checkout.txn_ref}`);
      } else if (result.alreadyProvisioned) {
        results.stuckCheckoutsRecovered++;
      } else {
        // Auto-provisioning failed — flag for manual follow-up with error detail
        await supabase
          .from('pending_checkouts')
          .update({ status: 'needs_manual_provisioning' })
          .eq('id', checkout.id);
        results.stuckCheckoutsStillPending++;
        console.error(
          `[Reconciliation] Auto-provisioning failed for ${checkout.txn_ref}: ${result.error}`
        );
      }

    } else if (status.statusCode === '0399' || status.statusCode === '0392') {
      // Genuinely failed or aborted at the provider — safe to close out
      await supabase
        .from('pending_checkouts')
        .update({ status: 'expired' })
        .eq('id', checkout.id);
      results.stuckCheckoutsRecovered++;

    } else {
      // 0398 (initiated) or 0396 (awaited) — still in-flight at Paynimo's end
      results.stuckCheckoutsStillPending++;
    }
  }

  // ── Part 2: subscription lifecycle / dunning ──────────────────────────────
  const { data: expiredSubs } = await supabase
    .from('subscriptions')
    .select('id, provider_subscription_id, grace_period_ends_at, dunning_attempts')
    .eq('status', 'active')
    .lt('current_period_end', new Date().toISOString());

  for (const sub of expiredSubs || []) {
    if (sub.provider_subscription_id.startsWith('trial_')) {
      await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', sub.id);
      results.expiredSubsReconciled++;
      continue;
    }

    await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        grace_period_ends_at: new Date(
          Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .eq('id', sub.id);
    results.subsEnteredGracePeriod++;
  }

  const { data: graceExpired } = await supabase
    .from('subscriptions')
    .select('id, dunning_attempts')
    .eq('status', 'past_due')
    .lt('grace_period_ends_at', new Date().toISOString());

  for (const sub of graceExpired || []) {
    const attempts = (sub.dunning_attempts ?? 0) + 1;
    if (attempts >= DUNNING_MAX_ATTEMPTS) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'expired',
          dunning_attempts: attempts,
          last_dunning_at: new Date().toISOString(),
        })
        .eq('id', sub.id);
      await supabase
        .from('licenses')
        .update({ status: 'expired' })
        .eq('subscription_id', sub.id);
      results.subsExpiredAfterGrace++;
    } else {
      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          dunning_attempts: attempts,
          last_dunning_at: new Date().toISOString(),
          grace_period_ends_at: new Date(
            Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .eq('id', sub.id);
    }
  }

  return NextResponse.json({ success: true, ...results });
}