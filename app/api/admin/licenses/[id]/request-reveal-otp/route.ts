import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { sendEmailViaGraph } from '@/lib/email';
import crypto from 'crypto';

// Mirrors hashOtp() in app/api/auth/send-2fa/route.ts exactly, but reuses
// MFA_OTP_PEPPER deliberately — both are "hash a 6-digit OTP code", the same
// kind of secret for the same purpose, just gating a different action. This
// is different from LICENSE_KEY_ENCRYPTION_SECRET, which protects different
// data (the key itself) and stays its own dedicated secret.
function hashOtp(code: string): string {
  const pepper = process.env.MFA_OTP_PEPPER;
  if (!pepper) throw new Error('MFA_OTP_PEPPER is required');
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: licenseId } = await params;
  const supabase = createClient();

  const adminCheck = await requireAdmin(supabase);
  if (!adminCheck.allowed) return adminCheck.response;
  const admin = adminCheck.user!;

  // Rate-limited per admin, same 'mfa' bucket as login 2FA — there's no
  // reason a reveal-OTP needs a more permissive limit than login verification
  // already has, and reusing the bucket avoids having to size a new limit.
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

  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes — shorter than login MFA's window, since this gates a single specific sensitive action rather than a login session

  // One row per (admin, license) — clears any stale unverified request before
  // issuing a new one, same pattern as mfa_codes' per-user upsert.
  await adminSupabase.from('license_reveal_otps').delete().eq('admin_user_id', admin.id).eq('license_id', licenseId);
  await adminSupabase.from('license_reveal_otps').insert({
    admin_user_id: admin.id,
    license_id: licenseId,
    code_hash: codeHash,
    expires_at: expiresAt.toISOString(),
  });

  // Sent to the ADMIN's own email — never the customer's. This verifies it's
  // really the logged-in admin making the request (not just someone who
  // already has their browser session), not that the customer approves.
  const adminEmail = admin.email;
  if (adminEmail) {
    await sendEmailViaGraph(
      adminEmail,
      'WPShield Admin: License Reveal Verification Code',
      `<h2>License reveal verification</h2>
       <p>A request was made to view a customer's raw license key.</p>
       <p>Your verification code:</p>
       <p style="padding:12px;background:#f4f4f4;border:1px solid #ccc;font-family:monospace;font-size:20px;letter-spacing:4px;">${code}</p>
       <p>This code expires in 10 minutes. If you didn't request this, contact your security team immediately.</p>`
    );
  }

  return NextResponse.json({ success: true });
}