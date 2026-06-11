import { createAdminClient } from "@/lib/supabase/admin";

const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function severityMeetsThreshold(severity: string, threshold: string): boolean {
  return (SEVERITY_RANK[severity] ?? 0) >= (SEVERITY_RANK[threshold] ?? 0);
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#dc2626";
    case "high":     return "#ea580c";
    case "medium":   return "#ca8a04";
    default:         return "#16a34a";
  }
}

function buildEmailHtml(payload: {
  alert_title: string;
  alert_description: string;
  severity: string;
  site_url?: string;
  dashboard_url?: string;
  company_name?: string;
}): string {
  const color = getSeverityColor(payload.severity);
  const dashboardLink = payload.dashboard_url || "https://wpshield.cybernara.com/app/alerts";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    
    <!-- Header -->
    <div style="background:linear-gradient(to right,#0a6358,#000);padding:24px 28px">
      <p style="margin:0;color:#fff;font-size:18px;font-weight:700">Cybernara WPShield</p>
      <p style="margin:4px 0 0;color:#99f6e4;font-size:12px">Security Alert</p>
    </div>

    <!-- Body -->
    <div style="padding:28px">
      <!-- Severity badge -->
      <span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px">
        ${payload.severity}
      </span>

      <h2 style="margin:0 0 10px;font-size:18px;color:#111">${payload.alert_title}</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6">${payload.alert_description}</p>

      ${payload.site_url ? `<p style="margin:0 0 20px;font-size:13px;color:#6b7280">Site: <a href="${payload.site_url}" style="color:#0d9488">${payload.site_url}</a></p>` : ""}

      <a href="${dashboardLink}" style="display:inline-block;background:#0a6358;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">
        View in Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        You are receiving this because your WPShield notification threshold is set to <strong>${payload.severity}</strong> or above.
        Manage preferences in your dashboard settings.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildSlackMessage(payload: {
  alert_title: string;
  alert_description: string;
  severity: string;
  site_url?: string;
  dashboard_url?: string;
}): object {
  const emoji: Record<string, string> = {
    critical: "🚨",
    high:     "⚠️",
    medium:   "🔔",
    low:      "ℹ️",
  };

  return {
    text: `${emoji[payload.severity] ?? "🔔"} *WPShield Alert: ${payload.alert_title}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji[payload.severity] ?? "🔔"} *${payload.alert_title}*\n${payload.alert_description}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Severity:* ${payload.severity.toUpperCase()}${payload.site_url ? `  |  *Site:* ${payload.site_url}` : ""}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View in Dashboard" },
            url: payload.dashboard_url || "https://wpshield.cybernara.com/app/alerts",
            style: "primary",
          },
        ],
      },
    ],
  };
}

export async function sendAlertNotification(payload: {
  company_id: string;
  alert_title: string;
  alert_description: string;
  severity: string;
  site_url?: string;
}) {
  try {
    const admin = createAdminClient();

    // Fetch company notification preferences
    const { data: company, error } = await admin
      .from("companies")
      .select("notify_email, notify_slack_webhook, notify_severity_threshold, display_name, site_url")
      .eq("company_id", payload.company_id)
      .single();

    if (error || !company) {
      console.error("[notify] Could not fetch company prefs:", error?.message);
      return;
    }

    const threshold = company.notify_severity_threshold || "high";

    // Check if this alert meets the threshold
    if (!severityMeetsThreshold(payload.severity, threshold)) {
      console.log(`[notify] Skipping — severity ${payload.severity} below threshold ${threshold}`);
      return;
    }

    const siteUrl = payload.site_url || company.site_url || "";
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://wpshield.cybernara.com" : "http://localhost:3000"}/app/alerts`;

    const promises: Promise<void>[] = [];

    // ── Email via Microsoft Graph ──────────────────────────────────────────
    if (company.notify_email) {
      promises.push(
        (async () => {
          const html = buildEmailHtml({
            alert_title: payload.alert_title,
            alert_description: payload.alert_description,
            severity: payload.severity,
            site_url: siteUrl,
            dashboard_url: dashboardUrl,
            company_name: company.display_name,
          });

          const { sendEmailViaGraph } = await import('@/lib/ms-graph');
          
          const success = await sendEmailViaGraph(
            company.notify_email!,
            `[${payload.severity.toUpperCase()}] ${payload.alert_title}`,
            html
          );

          if (!success) {
            console.error("[notify] MS Graph email failed to send.");
          } else {
            console.log(`[notify] Email sent via MS Graph to ${company.notify_email}`);
          }
        })()
      );
    }

    // ── Slack webhook ─────────────────────────────────────────────────────
    if (company.notify_slack_webhook) {
      promises.push(
        (async () => {
          const message = buildSlackMessage({
            alert_title: payload.alert_title,
            alert_description: payload.alert_description,
            severity: payload.severity,
            site_url: siteUrl,
            dashboard_url: dashboardUrl,
          });

          const slackAbort = new AbortController();
          const slackTimeout = setTimeout(() => slackAbort.abort(), 5000);

          const { safeFetch } = await import('@/lib/security/ssrf');
          const { decryptString } = await import('@/lib/security/encryption');
          const webhookUrl = decryptString(company.notify_slack_webhook!);
          const res = await safeFetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
            signal: slackAbort.signal,
          }).finally(() => clearTimeout(slackTimeout));

          if (!res.ok) {
            console.error("[notify] Slack webhook failed:", res.status);
          } else {
            console.log("[notify] Slack message sent");
          }
        })()
      );
    }

    await Promise.allSettled(promises);

  } catch (err: any) {
    // Never throw — notification failure must never break the cron job
    console.error("[notify] Unexpected error:", err.message);
  }
}