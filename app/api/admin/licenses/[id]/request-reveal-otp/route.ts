import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { sendEmailViaGraph } from '@/lib/email';
import crypto from 'crypto';

function hashOtp(code: string): string {
  const pepper = process.env.MFA_OTP_PEPPER;
  if (!pepper) throw new Error('MFA_OTP_PEPPER is required');
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Every code path below now goes through this try/catch — previously this
  // handler had none at all, so any thrown error (a missing env var, a
  // database hiccup, or — before lib/email.ts had a timeout — a hung
  // Microsoft Graph request) resulted in an unhandled exception. Next.js
  // turns that into a generic non-JSON error response, which the browser
  // can end up failing to parse in a way that looks like the request never
  // resolved at all from the UI's perspective. Wrapping everything here
  // guarantees a clean JSON response either way.
  try {
    const { id: licenseId } = await params;
    const supabase = createClient();

    const adminCheck = await requireAdmin(supabase);
    if (!adminCheck.allowed) return adminCheck.response;
    const admin = adminCheck.user!;

    const rate = await checkRateLimit('mfa', admin.id);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many attempts. Please wait before trying again.' }, { status: 429 });
    }

    const adminSupabase = createAdminClient();

    const { data: license } = await adminSupabase
      .from('licenses')
      .select('id')
      .eq('id', licenseId)
      .maybeSingle();

    if (!license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    if (!admin.email) {
      return NextResponse.json({ error: 'Your admin account has no email on file — cannot send a verification code.' }, { status: 400 });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await adminSupabase.from('license_reveal_otps').delete().eq('admin_user_id', admin.id).eq('license_id', licenseId);
    await adminSupabase.from('license_reveal_otps').insert({
      admin_user_id: admin.id,
      license_id: licenseId,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
    });

    // Sent to the ADMIN's own email — never the customer's. This verifies it's
    // really the logged-in admin making the request, not the customer's
    // approval.
    const emailSucceeded = await sendEmailViaGraph(
      admin.email,
      'WPShield Admin: License Reveal Verification Code',
      `<h2>License reveal verification</h2>
       <p>A request was made to view a customer's raw license key.</p>
       <p>Your verification code:</p>
       <p style="padding:12px;background:#f4f4f4;border:1px solid #ccc;font-family:monospace;font-size:20px;letter-spacing:4px;">${code}</p>
       <p>This code expires in 10 minutes. If you didn't request this, contact your security team immediately.</p>`
    );

    // Previously the result of sendEmailViaGraph was never checked, so a
    // genuine send failure (bad credentials, Graph API down, the recipient
    // address rejected) still returned {success:true} — the admin would be
    // left waiting on the "enter code" screen for an email that was never
    // actually sent, with nothing telling them it failed. Surfacing the real
    // outcome here means the modal can show an honest error instead.
    if (!emailSucceeded) {
      await adminSupabase.from('license_reveal_otps').delete().eq('admin_user_id', admin.id).eq('license_id', licenseId);
      return NextResponse.json({ error: 'Could not send the verification email. Check Microsoft Graph credentials / mail configuration and try again.' }, { status: 502 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[request-reveal-otp]', err.message);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}