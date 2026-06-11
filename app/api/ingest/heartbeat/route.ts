import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Rate Limit: 5 requests per minute per site
    const rateLimit = checkRateLimit(`ingest_hb_${auth.site_id}`, 5, 60);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too Many Requests' }, { 
        status: 429, 
        headers: { 'Retry-After': String(rateLimit.retryAfter) } 
      });
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
