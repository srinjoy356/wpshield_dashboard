import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';
import crypto from 'crypto';

import { sendEmailViaGraph } from '@/lib/ms-graph';

function hashOtp(code: string): string {
  const pepper = process.env.MFA_OTP_PEPPER;
  if (!pepper) throw new Error('MFA_OTP_PEPPER is required');
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rate = await checkRateLimit('mfa', user.id);
  if (!rate.success) {
    return NextResponse.json({ error: "Too many requests. Please wait before requesting another code." }, { status: 429 });
  }

  const admin = createAdminClient();

  // Check if an unexpired code already exists — we can't know what the existing code was
  // (it's hashed) so this is purely about not generating a brand new code if one is
  // still comfortably valid. There is nothing here to "reuse" in plaintext.
  const { data: existing } = await admin.from('mfa_codes').select('expires_at').eq('user_id', user.id).single();

  let code: string;
  if (existing && new Date(existing.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    // An existing code is still valid for more than 5 more minutes — don't issue a new one,
    // but we also can't re-send it since it's hashed at rest. Ask the user to wait it out
    // or request again closer to expiry, which is an acceptable trade-off for not storing
    // OTPs in plaintext.
    return NextResponse.json({ success: true, alreadySent: true });
  }

  code = crypto.randomInt(100000, 999999).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const codeHash = hashOtp(code);

  const { error } = await admin.from('mfa_codes').upsert({
    user_id: user.id,
    code: codeHash,
    expires_at,
    attempts: 0,
  });
  if (error) {
    console.error("MFA Insert Error:", error);
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }

  // OTP intentionally logged for dev only — gate in production
  if (process.env.NEXT_PUBLIC_DEBUG === "true") console.log(`[DEV] OTP for ${user.email} is: ${code}`);

  const success = await sendEmailViaGraph(
    user.email!,
    "WPShield - Your Login Code",
    `<h2>Your verification code is: <strong>${code}</strong></h2><p>This code expires in 10 minutes.</p>`
  );

  if (!success) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}