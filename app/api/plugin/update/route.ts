import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: release, error } = await supabase
      .from('plugin_releases')
      .select('version, zip_url, changelog, released_at')
      .eq('is_latest', true)
      .single();

    if (error || !release) {
      return NextResponse.json({ error: 'No release found' }, { status: 404 });
    }

    return NextResponse.json({
      version:      release.version,
      download_url: release.zip_url,
      changelog:    release.changelog,
      released_at:  release.released_at,
      name:         'WPShield Security',
      slug:         'cybernara-wpshield',
      author:       'Cybernara',
      requires:     '5.8',
      tested:       '6.7',
      sections: {
        description: 'Advanced WordPress security monitoring and protection by Cybernara.',
        changelog:   release.changelog || 'Bug fixes and improvements.',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}