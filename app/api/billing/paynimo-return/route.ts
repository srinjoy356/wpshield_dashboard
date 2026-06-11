import { NextResponse } from 'next/server';
import { Paynimo } from '@/lib/billing/paynimo';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmailViaGraph } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
  let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    const planCode = url.searchParams.get('plan_code');

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // Paynimo sends form data in the POST body
    const formData = await request.formData();
    const msg = formData.get('msg') as string;

    if (!msg) {
      return NextResponse.json({ error: "No response msg returned from Paynimo" }, { status: 400 });
    }

    // Verify the Dual Verification Hash
    const isValid = Paynimo.verifyResponseHash(msg);
    if (!isValid) {
      console.error("[Paynimo Return] Hash Verification Failed!");
      return NextResponse.redirect(`${baseUrl}/app/settings?error=hash_mismatch`, 303);
    }

    console.log("[Paynimo Return] Valid Response:", msg);

    const parts = msg.split('|');
    // Checkout JS Response Format:
    // txn_status|txn_msg|txn_err_msg|clnt_txn_ref|tpsl_bank_cd|tpsl_txn_id|txn_amt|clnt_rqst_meta|tpsl_txn_time|bal_amt|card_id|alias_name|BankTransactionID|mandate_reg_no|token|hash
    const authStatus = parts[0];
    const authMsg = parts[1];
    const txnRefNo = parts[3];
    const tpslTxnId = parts[5];
    const txnAmt = parts[6];

    if (authStatus !== '0300') {
      // Payment Failed (0398 = Initiated, 0399 = Failure, 0396 = Awaited, 0392 = Aborted)
      console.log(`[Paynimo] Payment Failed: ${authStatus} - ${authMsg}`);
      return NextResponse.redirect(`${baseUrl}/app/settings?error=payment_failed`, 303);
    }

    console.log(`[Paynimo] Payment Success for ${txnRefNo} (${txnAmt} INR)`);

    if (!userId || !planCode) {
       console.error("Missing userId or planCode in return URL");
       return NextResponse.redirect(`${baseUrl}/app/settings?error=missing_params`, 303);
    }

    const supabase = createAdminClient();

    // 1. Ensure Customer exists
    let { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (!customer) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = userData?.user?.email;
      
      if (!userEmail) {
        console.error("Could not find user email for ID:", userId);
        throw new Error("Could not find user email");
      }

      const { data: newCust, error } = await supabase.from('customers').insert({
        owner_user_id: userId,
        email: userEmail,
        provider_customer_id: `paynimo_cust_${userId}`
      }).select('id').single();
      if (error) throw error;
      customer = newCust;
    }

    // 2. Create Invoice
    await supabase.from('invoices').insert({
      customer_id: customer.id,
      provider_invoice_id: tpslTxnId || txnRefNo,
      amount: Math.round(parseFloat(txnAmt) * 100), // convert to paisa
      status: 'paid'
    });

    // 3. Find Plan
    const { data: plan } = await supabase
      .from('plans')
      .select('id')
      .eq('id', planCode)
      .maybeSingle();

    if (plan) {
      // 4. Create Subscription
      const mockSubId = `sub_paynimo_${txnRefNo}`;
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .upsert({
          customer_id: customer.id,
          plan_id: plan.id,
          provider_subscription_id: mockSubId,
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 days
        }, { onConflict: 'provider_subscription_id' })
        .select('id')
        .single();

      if (error) throw error;

      if (subscription) {
        // 5. Generate License Key
        const rawKey = 'wp_' + crypto.randomBytes(32).toString('hex');
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        await supabase.from('licenses').insert({
          subscription_id: subscription.id,
          key_hash: keyHash,
          status: 'active'
        });

        // 6. Send Email via MS Graph
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const email = userData?.user?.email;

        if (email) {
          const htmlReport = `
            <h2>Welcome to WPShield Premium (Powered by Worldline Paynimo)</h2>
            <p>Your test transaction of INR ${txnAmt} was successful.</p>
            <p>Your subscription is active. Here is your WordPress Plugin API License Key:</p>
            <p style="padding: 12px; background: #f4f4f4; border: 1px solid #ccc; font-family: monospace; font-size: 16px;">
              ${rawKey}
            </p>
            <p><strong>Keep this key secure.</strong> You will need to enter it in your WordPress dashboard.</p>
          `;
          
          // Log it to terminal as requested
          console.log("================================================");
          console.log(`[MS GRAPH EMAIL CONTENT FOR: ${email}]`);
          console.log(htmlReport);
          console.log("================================================");

          await sendEmailViaGraph(email, "Your WPShield License Key (Paynimo)", htmlReport);
        }
      }
    }

    // Redirect user to settings page
    return NextResponse.redirect(`${baseUrl}/app/settings?success=1`, 303);

  } catch (err: any) {
    console.error("Paynimo Return Processing Error:", err);
    return NextResponse.redirect(`${baseUrl}/app/settings?error=server_error`, 303);
  }
}
