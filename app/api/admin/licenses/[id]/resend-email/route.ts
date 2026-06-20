import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { decryptLicenseKey } from '@/lib/security/license-crypto';
import { sendEmailViaGraph } from '@/lib/email';
import crypto from 'crypto';

function hashOtp(code: string): string {
  const pepper = process.env.MFA_OTP_PEPPER;
  if (!pepper) throw new Error('MFA_OTP_PEPPER is required');
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  console.log('[resend-email] handler entered');
  try {
    const { id: licenseId } = await params;
    const supabase = createClient();

    const adminCheck = await requireAdmin(supabase);
    if (!adminCheck.allowed) {
      console.log('[resend-email] requireAdmin rejected');
      return adminCheck.response;
    }
    const admin = adminCheck.user!;
    console.log('[resend-email] admin verified:', admin.id);

    const rate = await checkRateLimit('mfa', admin.id);
    if (!rate.success) {
      console.log('[resend-email] rate limited');
      return NextResponse.json({ error: 'Too many attempts. Please wait before trying again.' }, { status: 429 });
    }

    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      console.log('[resend-email] missing/invalid code');
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    const { data: otpRow } = await adminSupabase
      .from('license_reveal_otps')
      .select('*')
      .eq('admin_user_id', admin.id)
      .eq('license_id', licenseId)
      .maybeSingle();

    if (!otpRow) {
      console.log('[resend-email] no pending OTP row found');
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    if (new Date(otpRow.expires_at) < new Date()) {
      console.log('[resend-email] OTP expired');
      await adminSupabase.from('license_reveal_otps').delete().eq('id', otpRow.id);
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    if ((otpRow.attempts ?? 0) >= 5) {
      console.log('[resend-email] too many failed attempts');
      return NextResponse.json({ error: 'Too many failed attempts. Request a new code.' }, { status: 429 });
    }

    const submittedHash = hashOtp(code);
    const storedBuf    = Buffer.from(otpRow.code_hash, 'hex');
    const submittedBuf = Buffer.from(submittedHash, 'hex');
    const isCodeMatch = storedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(storedBuf, submittedBuf);

    if (!isCodeMatch) {
      console.log('[resend-email] code did not match');
      await adminSupabase.from('license_reveal_otps').update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq('id', otpRow.id);
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    console.log('[resend-email] code matched, consuming OTP');

    await adminSupabase.from('license_reveal_otps').delete().eq('id', otpRow.id);

    const { data: license } = await adminSupabase
      .from('licenses')
      .select('id, encrypted_key, subscription_id')
      .eq('id', licenseId)
      .maybeSingle();

    if (!license) {
      console.log('[resend-email] license not found');
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }
    if (!license.encrypted_key) {
      console.log('[resend-email] no encrypted_key on file');
      return NextResponse.json({ error: 'No recoverable key on file for this license (issued before key escrow was added).' }, { status: 404 });
    }

    const { data: subscription } = await adminSupabase
      .from('subscriptions')
      .select('customer_id')
      .eq('id', license.subscription_id)
      .maybeSingle();
    if (!subscription) {
      console.log('[resend-email] subscription not found for license.subscription_id', license.subscription_id);
      return NextResponse.json({ error: 'Subscription not found for this license' }, { status: 404 });
    }

    const { data: customer } = await adminSupabase
      .from('customers')
      .select('owner_user_id, email')
      .eq('id', subscription.customer_id)
      .maybeSingle();
    if (!customer) {
      console.log('[resend-email] customer not found for subscription.customer_id', subscription.customer_id);
      return NextResponse.json({ error: 'Customer not found for this license' }, { status: 404 });
    }

    let recipientEmail = customer.email;
    if (!recipientEmail && customer.owner_user_id) {
      const { data: userData } = await adminSupabase.auth.admin.getUserById(customer.owner_user_id);
      recipientEmail = userData?.user?.email ?? null;
    }
    if (!recipientEmail) {
      console.log('[resend-email] no email found for customer at all');
      return NextResponse.json({ error: 'No email on file for this customer' }, { status: 404 });
    }
    console.log('[resend-email] resolved recipient:', recipientEmail);

    let rawKey: string;
    try {
      rawKey = decryptLicenseKey(license.encrypted_key);
      console.log('[resend-email] decryption succeeded');
    } catch (err: any) {
      console.error('[resend-email] Decryption failed:', err.message);
      return NextResponse.json({ error: 'Could not decrypt license key.' }, { status: 500 });
    }

    const emailStart = Date.now();
    const emailSucceeded = await sendEmailViaGraph(
      recipientEmail,
      'Your WPShield License Key (Resent)',
      `<h2>Your WPShield License Key</h2>
       <p>This is a resend of your license key, requested by support.</p>
       <p style="padding:12px;background:#f4f4f4;border:1px solid #ccc;font-family:monospace;font-size:16px;">${rawKey}</p>
       <p><strong>Keep this key secure.</strong> Enter it in your WordPress WPShield settings.</p>`
    );
    console.log(`[resend-email] sendEmailViaGraph returned ${emailSucceeded} after ${Date.now() - emailStart}ms`);

    await adminSupabase.from('licenses').update({
      delivery_status: emailSucceeded ? 'sent' : 'failed',
      delivery_error: emailSucceeded ? null : 'Resend attempt failed.',
      last_delivery_attempt_at: new Date().toISOString(),
    }).eq('id', licenseId);

    await adminSupabase.from('license_access_log').insert({
      admin_user_id: admin.id,
      license_id: licenseId,
      action: 'resent',
    });

    if (!emailSucceeded) {
      console.log('[resend-email] email failed, returning 500');
      return NextResponse.json({ error: 'Email send failed — see delivery status on the license.' }, { status: 500 });
    }

    console.log('[resend-email] success');
    return NextResponse.json({ success: true, sentTo: recipientEmail });

  } catch (err: any) {
    console.error('[resend-email] THREW:', err.name, err.message, err.stack);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}