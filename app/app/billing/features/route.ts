import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanFeatures } from '@/lib/billing/get-plan-features';

export const dynamic = 'force-dynamic';

/**
 * GET /api/billing/features
 * Returns the current user's plan feature flags as JSON.
 * Used by client components that need to conditionally render gated UI.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const features = await getPlanFeatures(supabase, user.id);

    return NextResponse.json({
      planId:             features.planId,
      planName:           features.planName,
      isActive:           features.isActive,
      maxSites:           features.maxSites,
      cloudDashboard:     features.cloudDashboard,
      emailAlerts:        features.emailAlerts,
      slackAlerts:        features.slackAlerts,
      fileIntegrityFull:  features.fileIntegrityFull,
      activityLogsFull:   features.activityLogsFull,
      ipBlocking:         features.ipBlocking,
      geoBlocking:        features.geoBlocking,
      awayMode:           features.awayMode,
      maintenanceMode:    features.maintenanceMode,
      pdfReports:         features.pdfReports,
      whitelabelReports:  features.whitelabelReports,
      multisiteDashboard: features.multisiteDashboard,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}