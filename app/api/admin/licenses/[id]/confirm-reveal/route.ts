import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/guards';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { decryptLicenseKey } from '@/lib/security/license-crypto';
import crypto from 'crypto';

function hashOtp(code: string): string {
  const pepper = process.env.MFA_OTP_PEPPER;
  if (!pepper) throw new Error('MFA_OTP_PEPPER is required');
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  console.log('[confirm-reveal] handler entered');
  try {
    const { id: licenseId } = await params;
    const supabase = createClient();

    const adminCheck = await requireAdmin(supabase);
    if (!adminCheck.allowed) {
      console.log('[confirm-reveal] requireAdmin rejected');
      return adminCheck.response;
    }
    const admin = adminCheck.user!;
    console.log('[confirm-reveal] admin verified:', admin.id);

    const rate = await checkRateLimit('mfa', admin.id);
    if (!rate.success) {
      console.log('[confirm-reveal] rate limited');
      return NextResponse.json({ error: 'Too many attempts. Please wait before trying again.' }, { status: 429 });
    }

    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      console.log('[confirm-reveal] missing/invalid code in request body');
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
      console.log('[confirm-reveal] no pending OTP row found for this admin+license — either never requested or already consumed');
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    console.log('[confirm-reveal] OTP row found, attempts so far:', otpRow.attempts);

    if (new Date(otpRow.expires_at) < new Date()) {
      console.log('[confirm-reveal] OTP expired at', otpRow.expires_at);
      await adminSupabase.from('license_reveal_otps').delete().eq('id', otpRow.id);
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    if ((otpRow.attempts ?? 0) >= 5) {
      console.log('[confirm-reveal] too many failed attempts');
      return NextResponse.json({ error: 'Too many failed attempts. Request a new code.' }, { status: 429 });
    }

    const submittedHash = hashOtp(code);
    const storedBuf    = Buffer.from(otpRow.code_hash, 'hex');
    const submittedBuf = Buffer.from(submittedHash, 'hex');

    const isCodeMatch = storedBuf.length === submittedBuf.length &&
      crypto.timingSafeEqual(storedBuf, submittedBuf);

    if (!isCodeMatch) {
      console.log('[confirm-reveal] code did not match');
      await adminSupabase.from('license_reveal_otps').update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq('id', otpRow.id);
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    console.log('[confirm-reveal] code matched, consuming OTP');

    await adminSupabase.from('license_reveal_otps').delete().eq('id', otpRow.id);

    const { data: license } = await adminSupabase
      .from('licenses')
      .select('id, encrypted_key, status')
      .eq('id', licenseId)
      .maybeSingle();

    if (!license) {
      console.log('[confirm-reveal] license not found');
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    if (!license.encrypted_key) {
      console.log('[confirm-reveal] license has no encrypted_key (pre-escrow license)');
      return NextResponse.json({ error: 'No recoverable key on file for this license (issued before key escrow was added).' }, { status: 404 });
    }

    let rawKey: string;
    try {
      rawKey = decryptLicenseKey(license.encrypted_key);
      console.log('[confirm-reveal] decryption succeeded');
    } catch (err: any) {
      console.error('[confirm-reveal] Decryption failed:', err.message);
      return NextResponse.json({ error: 'Could not decrypt license key.' }, { status: 500 });
    }

    await adminSupabase.from('license_access_log').insert({
      admin_user_id: admin.id,
      license_id: licenseId,
      action: 'revealed',
    });

    console.log('[confirm-reveal] success, returning key to client');
    return NextResponse.json({ success: true, licenseKey: rawKey });

  } catch (err: any) {
    console.error('[confirm-reveal] THREW:', err.name, err.message, err.stack);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}