import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

  if (!mfa) {
    console.error("2FA Error: No MFA record found for user", user.id);
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }
  
  const isCodeMatch = mfa.code === code;
  const isExpired = new Date(mfa.expires_at) < new Date();
  
  console.log("2FA Debug: DB Code:", mfa.code, "Entered Code:", code, "IsMatch:", isCodeMatch, "IsExpired:", isExpired, "ExpiresAt:", new Date(mfa.expires_at), "Now:", new Date());

  if (!isCodeMatch || isExpired) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  // Delete used code
  await admin.from('mfa_codes').delete().eq('user_id', user.id);

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  const redirectUrl = (profile?.role === 'admin' || profile?.role === 'super_admin') ? '/admin' : '/app';

  const res = NextResponse.json({ success: true, redirectUrl });
  // Set cookie valid for 8 hours
  res.cookies.set("wpshield_2fa_verified", "true", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 
  });

  return res;
}
