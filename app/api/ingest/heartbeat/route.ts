import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site_id) return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });

    const rate = await checkRateLimit('ingest', auth.site_id);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

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