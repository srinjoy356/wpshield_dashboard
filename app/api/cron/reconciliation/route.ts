import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Paynimo } from '@/lib/billing/paynimo';

export const dynamic = 'force-dynamic';

const STUCK_THRESHOLD_MINUTES = 30;
const DUNNING_MAX_ATTEMPTS = 3;
const GRACE_PERIOD_DAYS = 5;

export async function GET(request: Request) {
  const secretHeader = request.headers.get("x-cron-secret");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || secretHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results = {
    stuckCheckoutsChecked: 0,
    stuckCheckoutsRecovered: 0,
    stuckCheckoutsStillPending: 0,
    expiredSubsReconciled: 0,
    subsEnteredGracePeriod: 0,
    subsExpiredAfterGrace: 0,
  };

  // ── RG-08, part 1: recover checkouts stuck in 'processing' or 'pending' for
  //    too long. A checkout can get stuck here if the customer's browser never
  //    delivered the return POST (closed tab, network drop, etc.) even though
  //    the payment itself went through on Paynimo's side — without this, that
  //    customer would have paid and received nothing, with no automated path
  //    to recovery.
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
  const { data: stuckCheckouts } = await supabase
    .from('pending_checkouts')
    .select('*')
    .in('status', ['pending', 'processing'])
    .lt('created_at', stuckThreshold);

  for (const checkout of stuckCheckouts || []) {
    results.stuckCheckoutsChecked++;

    const status = await Paynimo.checkTransactionStatus(checkout.txn_ref, new Date(checkout.created_at));

    // Log every reconciliation lookup to webhook_events for auditability, same
    // as a real-time webhook would be — this is exactly the kind of "what did
    // the provider actually say" record RG-07 was about, just sourced from a
    // polled status check instead of a pushed callback.
    await supabase.from('webhook_events').upsert({
      provider: 'paynimo',
      provider_event_id: `reconcile_${checkout.txn_ref}_${Date.now()}`,
      payload: { source: 'reconciliation_cron', checkout_id: checkout.id, txn_ref: checkout.txn_ref, status },
      status: status ? 'received' : 'failed',
    }, { onConflict: 'provider,provider_event_id' });

    if (!status) {
      // Couldn't reach Paynimo or got an unexpected response — leave the
      // checkout as-is and try again on the next cron run rather than
      // guessing at an outcome.
      results.stuckCheckoutsStillPending++;
      continue;
    }

    if (status.statusCode === '0300') {
      // Paynimo confirms this succeeded but we never processed it — mark it
      // back to 'pending' so the existing paynimo-return provisioning logic
      // picks it up cleanly on next webhook delivery, OR flag it for manual
      // admin follow-up if Paynimo never retries the callback on their side.
      // Safest available action from a cron job is surfacing this clearly
      // rather than attempting to replicate the full provisioning flow here
      // (that logic already exists, and duplicating it risks the two
      // implementations drifting out of sync).
      await supabase.from('pending_checkouts').update({
        status: 'needs_manual_provisioning',
        provider_txn_id: status.bankReferenceId || checkout.provider_txn_id,
      }).eq('id', checkout.id);
      results.stuckCheckoutsRecovered++;
      console.error(`[Reconciliation] Checkout ${checkout.txn_ref} succeeded at Paynimo but was never provisioned — flagged for manual follow-up.`);

    } else if (status.statusCode === '0399' || status.statusCode === '0392') {
      // Genuinely failed or aborted at the provider — safe to close out.
      await supabase.from('pending_checkouts').update({ status: 'expired' }).eq('id', checkout.id);
      results.stuckCheckoutsRecovered++;

    } else {
      // 0398 (initiated) or 0396 (awaited) — still genuinely in-flight at
      // Paynimo's end, not stuck due to our own failure. Leave it; it may
      // resolve on a future cron run.
      results.stuckCheckoutsStillPending++;
    }
  }

  // ── RG-08, part 2 / RG-11: subscription lifecycle — expired subscriptions
  //    enter a 'past_due' recovery window with dunning attempts before being
  //    cut off, instead of the previous binary active/halted jump. 'past_due'
  //    is used consistently for the entire recovery window (not split across
  //    two different status values) specifically so every cron run re-checks
  //    every subscription still inside that window — a status that changed
  //    partway through the window would stop being picked up by either query.
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

    // First time we've seen this subscription past its period end — start
    // the recovery window rather than cutting access immediately. A renewal
    // payment that's simply running a few minutes behind shouldn't lock
    // someone out instantly.
    await supabase.from('subscriptions').update({
      status: 'past_due',
      grace_period_ends_at: new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', sub.id);
    results.subsEnteredGracePeriod++;
  }

  // Subscriptions already past_due whose current recovery window has elapsed
  // without a successful renewal — either extend once more (within the
  // dunning attempt budget) or actually cut access off.
  const { data: graceExpired } = await supabase
    .from('subscriptions')
    .select('id, dunning_attempts')
    .eq('status', 'past_due')
    .lt('grace_period_ends_at', new Date().toISOString());

  for (const sub of graceExpired || []) {
    const attempts = (sub.dunning_attempts ?? 0) + 1;
    if (attempts >= DUNNING_MAX_ATTEMPTS) {
      await supabase.from('subscriptions').update({
        status: 'expired',
        dunning_attempts: attempts,
        last_dunning_at: new Date().toISOString(),
      }).eq('id', sub.id);
      await supabase.from('licenses').update({ status: 'expired' }).eq('subscription_id', sub.id);
      results.subsExpiredAfterGrace++;
    } else {
      // Extend the recovery window once more and record the attempt — status
      // stays 'past_due' so this same query catches it again next time its
      // window elapses, rather than landing in a status nothing re-checks.
      await supabase.from('subscriptions').update({
        status: 'past_due',
        dunning_attempts: attempts,
        last_dunning_at: new Date().toISOString(),
        grace_period_ends_at: new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', sub.id);
    }
  }

  return NextResponse.json({ success: true, ...results });
}