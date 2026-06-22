import { NextResponse } from 'next/server';
import { Paynimo } from '@/lib/billing/paynimo';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionPayment } from '@/lib/billing/provision-payment';

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

    // RG-07: log immediately before any processing
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

    // 2. Replay protection
    if (tpslTxnId) {
      const { data: dup } = await supabase
        .from('pending_checkouts')
        .select('id, status')
        .eq('provider_txn_id', tpslTxnId)
        .maybeSingle();

      if (dup?.status === 'completed') {
        if (webhookEventId) {
          await supabase.from('webhook_events').update({ status: 'completed' }).eq('id', webhookEventId);
        }
        return NextResponse.redirect(`${baseUrl}/app/billing?success=1`, 303);
      }
    }

    // 3. RG-09: Look up checkout (atomic claim is inside provisionPayment)
    const { data: checkoutRow } = await supabase
      .from('pending_checkouts')
      .select('id, status')
      .eq('txn_ref', txnRefNo)
      .maybeSingle();

    if (!checkoutRow) {
      console.error('[Paynimo Return] No matching pending checkout for txn_ref:', txnRefNo);
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'failed' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?error=invalid_txn`, 303);
    }

    if (checkoutRow.status === 'completed') {
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'completed' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?success=1`, 303);
    }

    if (checkoutRow.status === 'processing') {
      // Lost the race to a concurrent request — don't provision again
      if (webhookEventId) {
        await supabase.from('webhook_events').update({ status: 'received' }).eq('id', webhookEventId);
      }
      return NextResponse.redirect(`${baseUrl}/app/billing?info=processing`, 303);
    }

    // 4. Delegate all provisioning to the shared service
    const result = await provisionPayment(
      supabase,
      checkoutRow.id,
      tpslTxnId || '',
      txnAmt || '0',
      baseUrl,
    );

    if (webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({ status: result.success ? 'completed' : 'failed' })
        .eq('id', webhookEventId);
    }

    if (!result.success) {
      console.error('[Paynimo Return] Provisioning failed:', result.error);
      return NextResponse.redirect(`${baseUrl}/app/billing?error=server_error`, 303);
    }

    return NextResponse.redirect(`${baseUrl}/app/billing?success=1`, 303);

  } catch (err: any) {
    console.error('[Paynimo Return]', err.message);
    if (webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({ status: 'failed' })
        .eq('id', webhookEventId)
        .then(() => {}, () => {});
    }
    return NextResponse.redirect(`${baseUrl}/app/billing?error=server_error`, 303);
  }
}