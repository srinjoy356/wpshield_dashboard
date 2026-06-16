import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';
import crypto from 'crypto';

function hashOtp(code: string): string {
  const pepper = process.env.MFA_OTP_PEPPER;
  if (!pepper) throw new Error('MFA_OTP_PEPPER is required');
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

function sign2FAToken(userId: string): string {
  // MFA_COOKIE_SECRET must be its own dedicated secret — it must NEVER fall back to
  // CRON_SECRET. CRON_SECRET was previously exposed client-side (see HardeningContent.tsx
  // fix), so sharing it with the 2FA cookie signing key would let anyone who saw that
  // browser-bundle string forge a valid 2FA-verified session cookie.
  const secret = process.env.MFA_COOKIE_SECRET;
  if (!secret) throw new Error('MFA_COOKIE_SECRET is required');
  const timestamp = Date.now().toString();
  const payload   = `${userId}:${timestamp}`;
  const sig       = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit('mfa', user.id);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many attempts. Please wait before trying again." }, { status: 429 });
  }

  const { code } = await request.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: mfa } = await admin.from('mfa_codes')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!mfa) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  const isExpired = new Date(mfa.expires_at) < new Date();
  if (isExpired) {
    await admin.from('mfa_codes').delete().eq('user_id', user.id);
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  if ((mfa.attempts ?? 0) >= 5) {
    return NextResponse.json({ error: "Too many failed attempts. Request a new code." }, { status: 429 });
  }

  const submittedHash = hashOtp(code);
  const storedBuf    = Buffer.from(mfa.code, 'hex');
  const submittedBuf = Buffer.from(submittedHash, 'hex');

  // timingSafeEqual throws if buffer lengths differ — both are fixed-length sha256 hex
  // digests under normal operation, but guard it defensively anyway.
  const isCodeMatch = storedBuf.length === submittedBuf.length &&
    crypto.timingSafeEqual(storedBuf, submittedBuf);

  if (!isCodeMatch) {
    await admin.from('mfa_codes').update({ attempts: (mfa.attempts ?? 0) + 1 }).eq('user_id', user.id);
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await admin.from('mfa_codes').delete().eq('user_id', user.id);

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single();
  const redirectUrl = (profile?.role === 'admin' || profile?.role === 'super_admin')
    ? '/admin' : '/app';

  const signedToken = sign2FAToken(user.id);

  const res = NextResponse.json({ success: true, redirectUrl });
  res.cookies.set("wpshield_2fa_verified", signedToken, {
    path:     "/",
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   8 * 60 * 60,
  });

  return res;
}