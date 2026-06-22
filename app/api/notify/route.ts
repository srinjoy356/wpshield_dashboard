import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertNotification } from "@/lib/notify";
import { verifyCompanyAccess } from "@/lib/auth/verify-company-access";

// POST — save notification preferences
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { company_id, notify_email, notify_slack_webhook, notify_severity_threshold } = body;

  if (!company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  // Verify tenant ownership (SEC-001)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  // Gate: email and Slack alerts require Solo+ plan
  const { getPlanFeatures } = await import('@/lib/billing/get-plan-features');
  const features = await getPlanFeatures(supabase, user.id);
  if (!features.emailAlerts) {
    return NextResponse.json(
      { error: "Email and Slack alerts require Solo plan or above. Please upgrade your subscription." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { encryptString } = await import('@/lib/security/encryption');
  
  let finalWebhook = notify_slack_webhook;
  const isEncrypted = typeof notify_slack_webhook === 'string' && notify_slack_webhook.length > 33 && notify_slack_webhook[32] === ':';
  
  if (notify_slack_webhook && !isEncrypted) {
    finalWebhook = encryptString(notify_slack_webhook);
  }
  
  const { error } = await admin
    .from("companies")
    .update({ notify_email, notify_slack_webhook: finalWebhook, notify_severity_threshold })
    .eq("company_id", company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PUT — send a test notification
export async function PUT(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { company_id, site_url } = body;

  if (!company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  // Verify tenant ownership (SEC-001)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  await sendAlertNotification({
    company_id,
    alert_title: "Test Notification from WPShield",
    alert_description: "This is a test notification to verify your alert delivery settings are configured correctly.",
    severity: "high",
    site_url,
  });

  return NextResponse.json({ success: true });
}