import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/queries/profile';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const profile  = await getCurrentProfile(supabase);
    if (!profile || !['admin','super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file     = formData.get('zip') as File | null;
    const version  = (formData.get('version') as string)?.trim();
    const changelog = (formData.get('changelog') as string)?.trim() || '';

    if (!file || !version) {
      return NextResponse.json({ error: 'zip file and version are required' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Only .zip files are allowed' }, { status: 400 });
    }

    // Save to /uploads/releases/ folder
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'releases');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `cybernara-wpshield-${version}.zip`;
    const filepath = path.join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    const host     = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl  = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${protocol}://${host}`
    ).replace(/\/$/, '');
    // Serve via API route — not static files (Render filesystem is ephemeral)
    const zip_url  = `${baseUrl}/api/plugin/download?file=${filename}`;
    const zip_path = filepath;

    const adminSupabase = createAdminClient();

    // Unset previous latest
    await adminSupabase.from('plugin_releases').update({ is_latest: false }).eq('is_latest', true);

    // Insert new release
    const { data: release, error: dbErr } = await adminSupabase
      .from('plugin_releases')
      .insert({
        version, changelog, zip_path, zip_url,
        is_latest:   true,
        released_by: profile.id,
      })
      .select('id, version')
      .single();

    if (dbErr) throw new Error(dbErr.message);

    return NextResponse.json({ success: true, release });

  } catch (err: any) {
    console.error('[Plugin Upload]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createClient();
    const profile  = await getCurrentProfile(supabase);
    if (!profile || !['admin','super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const { data: releases } = await adminSupabase
      .from('plugin_releases')
      .select('id, version, changelog, zip_url, is_latest, released_at')
      .order('released_at', { ascending: false });

    return NextResponse.json({ releases: releases || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}