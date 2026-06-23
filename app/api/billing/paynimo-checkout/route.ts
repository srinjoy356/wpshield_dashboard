import { NextResponse } from 'next/server';
import { Paynimo } from '@/lib/billing/paynimo';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { getEffectivePrice } from '@/lib/billing/pricing';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 0. Session is the only source of truth for identity — never trust the body for this.
    const supabase = createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rate = await checkRateLimit('checkout', user.id);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many checkout attempts. Please try again later.' }, { status: 429 });
    }

    const { plan_code } = await request.json();
    if (!plan_code) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user_id = user.id;
    const customer_email = user.email!;

    const admin = createAdminClient();

    // Server loads price — client never sets the amount
    const { data: plan, error: planErr } = await admin
      .from('plans')
      .select('id, name, price_inr_test, price_inr_live, price_usd, price_usd_live, currency, max_sites')
      .eq('id', plan_code)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // RG-02: live/test switch lives in one shared place (lib/billing/pricing.ts)
    // so this is never computed differently than what the billing UI displays.
    const effectivePrice = getEffectivePrice(plan);

    // This specific checkout flow talks to Paynimo with currency hardcoded to
    // INR throughout (see consumerData below) — it was never built to handle
    // a non-INR transaction. Rather than silently sending a USD number through
    // as if it were rupees (a real, serious bug if a 'global' region plan is
    // ever marked currency='USD'), refuse the checkout outright until USD
    // payment processing is actually wired up. The schema supports global/USD
    // plans today; this route enforcing INR-only is what's actually safe to
    // ship right now.
    if (effectivePrice.currency !== 'INR') {
      return NextResponse.json({
        error: 'This plan is not yet available for checkout — USD billing is not enabled yet. Please contact support.'
      }, { status: 400 });
    }

    const amount    = effectivePrice.amount;

    // Block free plans — amount=0 would send a ₹0 request to Paynimo which rejects it.
    if (amount <= 0) {
      return NextResponse.json({ error: "This plan is free and does not require a payment." }, { status: 400 });
    }
    const txnRefNo  = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiry

    // Plan switches (upgrades/downgrades) are allowed.
    // provision-payment.ts cancels the existing subscription when a new one
    // is created for a different plan — no double-subscription risk.

    // Create pending checkout record — return handler verifies against this
    const { error: pcErr } = await admin.from('pending_checkouts').insert({
      user_id,
      plan_id:              plan.id,
      txn_ref:              txnRefNo,
      expected_amount_inr:  amount,
      status:               'pending',
      expires_at:           expiresAt.toISOString(),
    });

    if (pcErr) throw new Error(`Failed to create pending checkout: ${pcErr.message}`);

    const host    = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${protocol}://${host}`
    ).replace(/\/$/, '');
    const returnUrl  = `${baseUrl}/api/billing/paynimo-return`;

    const token = Paynimo.generateCheckoutToken(
      txnRefNo, amount, user_id, customer_email, '9999999999'
    );

    return NextResponse.json({
      reqJson: {
        features: {
          enableAbortResponse: true, enableExpressPay: true,
          enableInstrumentDeRegistration: true, enableMerTxnDetails: true,
        },
        consumerData: {
          deviceId: 'WEBSH2',
          token,
          returnUrl,
          paymentMode: 'all',
          merchantId: Paynimo.getMerchantCode(),
          currency: 'INR',
          consumerId: user_id,
          consumerEmailId: customer_email,
          consumerMobileNo: '9999999999',
          txnId: txnRefNo,
          items: [{ itemId: 'FIRST', amount: amount.toString(), comAmt: '0' }],
          customStyle: {
            PRIMARY_COLOR_CODE:   '#0a6358',
            SECONDARY_COLOR_CODE: '#FFFFFF',
            BUTTON_COLOR_CODE_1:  '#107C6B',
            BUTTON_COLOR_CODE_2:  '#FFFFFF',
          },
        },
      },
    });
  } catch (err: any) {
    console.error('[Checkout]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}