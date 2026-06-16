import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/plugin/download?file=<storage-key>
 *
 * This is now an admin-only manual download link (used by the "Download" link in
 * app/admin/plugin/page.tsx), NOT the path the WordPress auto-updater uses anymore.
 * The auto-updater gets a fresh signed URL directly from /api/plugin/update, scoped to
 * a license with an active subscription. This route is scoped to a logged-in admin
 * session instead, and no longer reads from local disk (public/uploads/releases was on
 * Render's ephemeral filesystem and didn't survive redeploys).
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient.from('user_profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');

    if (!filename || !filename.endsWith('.zip') || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const { data: signed, error } = await adminClient.storage
      .from('plugin-releases')
      .createSignedUrl(filename, 300);

    if (error || !signed) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}