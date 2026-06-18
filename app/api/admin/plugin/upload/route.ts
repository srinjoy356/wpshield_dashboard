import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/queries/profile';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function signRelease(buffer: Buffer): string {
  const privateKeyB64 = process.env.PLUGIN_SIGNING_PRIVATE_KEY;
  if (!privateKeyB64) throw new Error('PLUGIN_SIGNING_PRIVATE_KEY is required');
  const privateKeyPem = Buffer.from(privateKeyB64, 'base64').toString('utf8');
  // ECDSA-SHA256 signature over the raw zip bytes. createSign('SHA256') hashes the input
  // internally — don't pre-hash it yourself, or you end up signing sha256(sha256(buffer))
  // instead of sha256(buffer), which only "works" if the verifying side makes the exact
  // same mistake. The PHP side (openssl_verify with OPENSSL_ALGO_SHA256) also hashes its
  // input internally, so it must verify against these same raw bytes, not a pre-hashed one.
  const sign = crypto.createSign('SHA256');
  sign.update(buffer);
  sign.end();
  return sign.sign(privateKeyPem).toString('base64');
}

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

    const buffer   = Buffer.from(await file.arrayBuffer());
    const filename = `cybernara-wpshield-${version}.zip`;
    const signature = signRelease(buffer);
    // RG-13: store an independent checksum alongside the signature — this lets anyone
    // (an admin, a support investigation, or the plugin itself as a second check
    // alongside signature verification) confirm a downloaded zip exactly matches what
    // was uploaded, without needing the signing keypair at all.
    const sha256Checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileSizeBytes  = buffer.length;

    const adminSupabase = createAdminClient();

    // Upload to a private Supabase Storage bucket — NOT local disk. Render's filesystem
    // is ephemeral, so anything written to public/uploads/releases previously vanished
    // on every redeploy regardless of how it was being served.
    const { error: uploadErr } = await adminSupabase.storage
      .from('plugin-releases')
      .upload(filename, buffer, { contentType: 'application/zip', upsert: true });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const host     = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl  = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${protocol}://${host}`
    ).replace(/\/$/, '');

    // zip_url is now only used for the admin-only manual download link in the dashboard
    // UI — the WordPress auto-updater gets a fresh signed URL straight from
    // /api/plugin/update instead, scoped to a license with an active subscription.
    const zip_url  = `${baseUrl}/api/plugin/download?file=${filename}`;
    const zip_path = filename; // storage object key, not a local filesystem path anymore

    // Unset previous latest
    await adminSupabase.from('plugin_releases').update({ is_latest: false }).eq('is_latest', true);

    // Insert new release
    const { data: release, error: dbErr } = await adminSupabase
      .from('plugin_releases')
      .insert({
        version, changelog, zip_path, zip_url, signature,
        sha256_checksum: sha256Checksum,
        file_size_bytes: fileSizeBytes,
        signing_key_id:  process.env.PLUGIN_SIGNING_KEY_ID || 'default',
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
      .select('id, version, changelog, zip_url, sha256_checksum, file_size_bytes, is_latest, released_at')
      .order('released_at', { ascending: false });

    return NextResponse.json({ releases: releases || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}