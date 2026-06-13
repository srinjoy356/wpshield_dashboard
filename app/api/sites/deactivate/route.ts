import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const supabase = createAdminClient();

    // Mark site inactive and revoke all tokens
    await supabase.from('sites')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('id', auth.site_id);

    await supabase.from('site_tokens')
      .update({ revoked: true })
      .eq('site_id', auth.site_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Sites Deactivate]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}