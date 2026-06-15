import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all active sites
  const { data: sites, error } = await supabase
    .from('sites')
    .select('url, company_id')
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sites || sites.length === 0) {
    return NextResponse.json({ success: true, message: 'No active sites', triggered: 0 });
  }

  // Ping WP-Cron on every active site simultaneously
  const results = await Promise.allSettled(
    sites.map(async (site) => {
      const url = `${site.url.replace(/\/$/, '')}/wp-cron.php?doing_wp_cron`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'WPShield-CronTrigger/1.0' },
        });
        return { site: site.url, status: 'ok' };
      } catch {
        return { site: site.url, status: 'failed' };
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const triggered = results.filter(r => r.status === 'fulfilled').length;
  const failed    = results.filter(r => r.status === 'rejected').length;

  console.log(`[WP-Cron] Triggered ${triggered}/${sites.length} sites`);

  return NextResponse.json({ success: true, triggered, failed, total: sites.length });
}

// Also accept POST for flexibility
export async function POST(request: Request) {
  return GET(request);
}