import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

import { sendEmailViaGraph } from '@/lib/ms-graph';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  
  // Check if an unexpired code already exists
  const { data: existing } = await admin.from('mfa_codes').select('*').eq('user_id', user.id).single();
  
  let code = "";
  if (existing && new Date(existing.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    code = existing.code;
  } else {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await admin.from('mfa_codes').upsert({
      user_id: user.id,
      code,
      expires_at
    });
    if (error) {
      console.error("MFA Insert Error:", error);
      return NextResponse.json({ error: "DB Error" }, { status: 500 });
    }
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