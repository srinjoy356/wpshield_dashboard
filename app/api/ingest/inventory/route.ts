import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { z } from 'zod';

const InventorySchema = z.object({
  site_url: z.string().url().max(500),
  kind: z.enum(['plugins', 'themes', 'core', 'users']),
  data: z.array(z.object({
    slug: z.string().max(200),
    name: z.string().max(200),
    version: z.string().max(50),
    is_active: z.number().int(),
    update_pending: z.number().int(),
  })).max(500),
});

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });

    const rate = await checkRateLimit('ingest', auth.site_id!);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const rawPayload = await request.json();
    const parsed = InventorySchema.safeParse(rawPayload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
    }
    const payload = parsed.data;

    const supabase = createAdminClient();

    await supabase.from('wpshield_inventory_snapshots').insert({
      company_id: auth.site.company_id,
      site_id: auth.site_id,
      site_url: payload.site_url,
      severity: 'info',
      kind: payload.kind,
      payload: payload.data,
      occurred_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}