import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

function sign2FAToken(userId: string): string {
  const secret = process.env.MFA_COOKIE_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error('MFA_COOKIE_SECRET is required');
  const payload = `${userId}:${Date.now()}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await request.json();
  const admin = createAdminClient();

  const { data: mfa } = await admin.from('mfa_codes')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!mfa) return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  const isCodeMatch = mfa.code === code;
  const isExpired   = new Date(mfa.expires_at) < new Date();

  if (!isCodeMatch || isExpired) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await admin.from('mfa_codes').delete().eq('user_id', user.id);

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  const redirectUrl = (profile?.role === 'admin' || profile?.role === 'super_admin') ? '/admin' : '/app';

  const signedToken = sign2FAToken(user.id);

  const res = NextResponse.json({ success: true, redirectUrl });
  res.cookies.set("wpshield_2fa_verified", signedToken, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60,
  });

  return res;
}