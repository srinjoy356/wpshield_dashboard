import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const payload = await request.json();
    const supabase = createAdminClient();

    await supabase.from('sites')
      .update({
        last_seen_at: new Date().toISOString(),
        plugin_version: payload.plugin_version
      })
      .eq('id', auth.site_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}