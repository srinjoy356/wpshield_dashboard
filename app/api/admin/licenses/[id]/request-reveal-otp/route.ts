import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { sendEmailViaGraph } from '@/lib/email';
import { debug } from '@/lib/debug';
import crypto from 'crypto';

function hashOtp(code: string): string {
  const pepper = process.env.MFA_OTP_PEPPER;
  if (!pepper) throw new Error('MFA_OTP_PEPPER is required');
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  console.log('[request-reveal-otp] handler entered');
  try {
    const { id: licenseId } = await params;
    console.log('[request-reveal-otp] licenseId:', licenseId);

    const supabase = createClient();
    const adminCheck = await requireAdmin(supabase);
    if (!adminCheck.allowed) {
      console.log('[request-reveal-otp] requireAdmin rejected — not an admin or not logged in');
      return adminCheck.response;
    }
    const admin = adminCheck.user!;
    console.log('[request-reveal-otp] admin verified:', admin.id, admin.email);

    const rate = await checkRateLimit('mfa', admin.id);
    if (!rate.success) {
      console.log('[request-reveal-otp] rate limited for admin', admin.id);
      return NextResponse.json({ error: 'Too many attempts. Please wait before trying again.' }, { status: 429 });
    }

    const adminSupabase = createAdminClient();

    const { data: license, error: licenseLookupErr } = await adminSupabase
      .from('licenses')
      .select('id')
      .eq('id', licenseId)
      .maybeSingle();

    if (licenseLookupErr) console.log('[request-reveal-otp] license lookup error:', licenseLookupErr.message);

    if (!license) {
      console.log('[request-reveal-otp] no license row found for id', licenseId);
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }
    console.log('[request-reveal-otp] license confirmed to exist');

    if (!admin.email) {
      console.log('[request-reveal-otp] admin has no email on file');
      return NextResponse.json({ error: 'Your admin account has no email on file — cannot send a verification code.' }, { status: 400 });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Same NEXT_PUBLIC_DEBUG-gated OTP logging pattern already used in
    // app/api/auth/send-2fa/route.ts — set NEXT_PUBLIC_DEBUG=true locally to
    // see the real code in the server console without needing email to work
    // at all. NEVER set this in production Render env vars (per lib/debug.ts's
    // own warning) — it would print real OTP codes into your logs.
    debug.log(`[DEV] License reveal OTP for ${admin.email} (license ${licenseId}) is: ${code}`);

    console.log('[request-reveal-otp] clearing any stale OTP row...');
    await adminSupabase.from('license_reveal_otps').delete().eq('admin_user_id', admin.id).eq('license_id', licenseId);

    console.log('[request-reveal-otp] inserting new OTP row...');
    const { error: insertErr } = await adminSupabase.from('license_reveal_otps').insert({
      admin_user_id: admin.id,
      license_id: licenseId,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
    });
    if (insertErr) {
      console.log('[request-reveal-otp] FAILED to insert OTP row:', insertErr.message);
      return NextResponse.json({ error: `Could not store verification code: ${insertErr.message}` }, { status: 500 });
    }
    console.log('[request-reveal-otp] OTP row inserted, now sending email...');

    const emailStart = Date.now();
    const emailSucceeded = await sendEmailViaGraph(
      admin.email,
      'WPShield Admin: License Reveal Verification Code',
      `<h2>License reveal verification</h2>
       <p>A request was made to view a customer's raw license key.</p>
       <p>Your verification code:</p>
       <p style="padding:12px;background:#f4f4f4;border:1px solid #ccc;font-family:monospace;font-size:20px;letter-spacing:4px;">${code}</p>
       <p>This code expires in 10 minutes. If you didn't request this, contact your security team immediately.</p>`
    );
    console.log(`[request-reveal-otp] sendEmailViaGraph returned ${emailSucceeded} after ${Date.now() - emailStart}ms`);

    if (!emailSucceeded) {
      await adminSupabase.from('license_reveal_otps').delete().eq('admin_user_id', admin.id).eq('license_id', licenseId);
      console.log('[request-reveal-otp] email send failed, returning 502');
      return NextResponse.json({ error: 'Could not send the verification email. Check Microsoft Graph credentials / mail configuration and try again.' }, { status: 502 });
    }

    console.log('[request-reveal-otp] success, returning 200');
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[request-reveal-otp] THREW:', err.name, err.message, err.stack);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}