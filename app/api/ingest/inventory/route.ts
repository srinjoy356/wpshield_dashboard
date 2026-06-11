import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const payload = await request.json();
    const supabase = createAdminClient();

    await supabase.from('wpshield_inventory_snapshots').insert({
      company_id: auth.site.company_id,
      site_url: payload.site_url || 'unknown',
      severity: 'info',
      kind: payload.kind || 'plugins',
      payload: payload.data || [],
      occurred_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}