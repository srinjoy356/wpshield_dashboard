import { NextResponse } from 'next/server';
import { Paynimo } from '@/lib/billing/paynimo';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { plan_code, customer_email, user_id } = await request.json();
    if (!plan_code || !customer_email || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Server loads price — client never sets the amount
    const { data: plan, error: planErr } = await supabase
      .from('plans')
      .select('id, name, price_inr_test, max_sites')
      .eq('id', plan_code)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const amount    = plan.price_inr_test; // ₹1 for starter, ₹5 for growth
    const txnRefNo  = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiry

    // Create pending checkout record — return handler verifies against this
    const { error: pcErr } = await supabase.from('pending_checkouts').insert({
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