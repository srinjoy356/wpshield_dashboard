import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { company_id, site_url, date_from, date_to } = await request.json();
    const admin = createAdminClient();

    // Fetch attack stats
    const { data: attacks } = await admin
      .from('wpshield_events_attack')
      .select('severity, pattern_type')
      .eq('company_id', company_id)
      .eq('site_url', site_url)
      .gte('occurred_at', date_from)
      .lte('occurred_at', date_to);

    let highSeverity = 0;
    let totalAttacks = attacks?.length || 0;
    
    attacks?.forEach(a => {
      if (a.severity === 'high') highSeverity++;
    });

    // Create a simple HTML report
    const htmlReport = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
            .header { background: #0a6358; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .stat-box { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            .stat-value { font-size: 24px; font-weight: bold; color: #0a6358; }
            .danger { color: #d9534f; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>WPShield Security Report</h1>
            <p>Site: ${site_url}</p>
            <p>${new Date(date_from).toLocaleDateString()} to ${new Date(date_to).toLocaleDateString()}</p>
          </div>
          <div class="content">
            <h2>Threat Summary</h2>
            <div class="stat-box">
              <p>Total Attacks Blocked: <span class="stat-value">${totalAttacks}</span></p>
              <p>High Severity Threats: <span class="stat-value danger">${highSeverity}</span></p>
            </div>
            <p>Your site is actively protected by WPShield. All detected threats were automatically mitigated.</p>
          </div>
        </body>
      </html>
    `;

    return NextResponse.json({ success: true, html: htmlReport });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
