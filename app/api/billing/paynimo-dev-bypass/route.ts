import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { planId, userEmail, userId } = await request.json();

    const txnRefNo = `TXN_${Date.now()}`;
    const tpslTxnId = `TPSL_${Date.now()}`;
    const PAYNIMO_KEY = process.env.PAYNIMO_ENCRYPTION_KEY || '3263390563ABSQUR';
    
    // Create a fake success message
    const rawMsg = [
      '0300', // authStatus
      'Transaction Successful', // authMsg
      '', // txn_err_msg
      txnRefNo, // clnt_txn_ref
      'TEST_BANK', // tpsl_bank_cd
      tpslTxnId, // tpsl_txn_id
      '5.00', // txn_amt
      '', // clnt_rqst_meta
      new Date().toISOString(), // tpsl_txn_time
      '', // bal_amt
      '', // card_id
      '', // alias_name
      'BANK_12345', // BankTransactionID
      '', // mandate_reg_no
      'token123' // token
    ].join('|');

    const rawDataForHash = rawMsg + '|' + PAYNIMO_KEY;
    const hash = crypto.createHash('sha512').update(rawDataForHash).digest('hex').toLowerCase();
    
    const finalMsg = rawMsg + '|' + hash;

    // Simulate the POST to our own return endpoint
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    
    const returnUrl = `${baseUrl}/api/billing/paynimo-return?user_id=${encodeURIComponent(userId)}&plan_code=${encodeURIComponent(planId)}`;
    
    const formData = new URLSearchParams();
    formData.append('msg', finalMsg);

    const res = await fetch(returnUrl, {
      method: 'POST',
      body: formData,
      redirect: 'manual' // Don't follow the 302 redirect
    });

    return NextResponse.json({ success: true, redirectLocation: res.headers.get('location') });
  } catch (err: any) {
    console.error("Bypass Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
