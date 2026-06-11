import { NextResponse } from 'next/server';
import { Paynimo } from '@/lib/billing/paynimo';

export async function POST(request: Request) {
  try {
    const { plan_code, customer_email, user_id } = await request.json();

    // Ensure test limits between 1 and 10 rupees
    const amount = Math.floor(Math.random() * 10) + 1;
    const txnRefNo = `TXN_${Date.now()}`;
    
    // Dynamically grab the host from the request headers so it works with Ngrok
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    
    // We attach custom params to the return URL so we can map them back after payment
    const returnUrl = `${baseUrl}/api/billing/paynimo-return?user_id=${encodeURIComponent(user_id)}&plan_code=${encodeURIComponent(plan_code)}`;

    const token = Paynimo.generateCheckoutToken(
      txnRefNo,
      amount,
      user_id, // consumerId
      customer_email,
      '9999999999' // customerMobile
    );

    // Return the config object expected by $.pnCheckout
    return NextResponse.json({
      reqJson: {
        "features": {
          "enableAbortResponse": true,
          "enableExpressPay": true,
          "enableInstrumentDeRegistration" : true,
          "enableMerTxnDetails": true
        },
        "consumerData": {
          "deviceId": "WEBSH2",
          "token": token,
          "returnUrl": returnUrl,
          "paymentMode": "all",
          "merchantId": Paynimo.getMerchantCode(),
          "currency": "INR",
          "consumerId": user_id,
          "consumerEmailId": customer_email,
          "consumerMobileNo": "9999999999",
          "txnId": txnRefNo,
          "items": [{
            "itemId": "FIRST",
            "amount": amount.toString(),
            "comAmt": "0"
          }],
          "customStyle": {
            "PRIMARY_COLOR_CODE": "#3b82f6", // tailwind blue-500
            "SECONDARY_COLOR_CODE": "#FFFFFF",
            "BUTTON_COLOR_CODE_1": "#2563eb", // tailwind blue-600
            "BUTTON_COLOR_CODE_2": "#FFFFFF"
          }
        }
      }
    });
  } catch (err: any) {
    console.error("Paynimo Checkout Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
