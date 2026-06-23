import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanFeatures } from '@/lib/billing/get-plan-features';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // getPlanFeatures now uses admin client internally — passing null is fine
    const features = await getPlanFeatures(null, user.id);

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