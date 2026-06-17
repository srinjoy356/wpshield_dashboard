import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { logActivity } from "@/lib/activity";
import { safeFetch } from "@/lib/security/ssrf";

export async function POST(req: Request) {
  try {
    // This route had no authentication check at all, and middleware.ts's matcher
    // explicitly excludes everything under /api — so it was reachable by anyone on the
    // internet who knew or guessed the URL, with company_id and file_path taken
    // straight from the request body. That's an unauthenticated arbitrary-file-deletion
    // primitive against any customer's WordPress site. Gating it the same way the other
    // admin-only mutating routes do (e.g. app/api/admin/plugin/upload/route.ts).
    const supabase = createClient();
    const profile  = await getCurrentProfile(supabase);
    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { action, site_id, file_path, file_hash } = body;

    if (!action || !site_id || !file_path) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Get site configuration (URL and Token Hash) — looked up directly by site_id,
    //    not inferred from company_id via "whichever site was created most recently."
    //    That fallback silently picked the WRONG site for any company with more than
    //    one active site, sending the remediation command (delete/quarantine a file)
    //    to a site that never even reported the alert being acted on.
    const { data: site, error: siteError } = await admin
      .from("sites")
      .select("id, url, company_id")
      .eq("id", site_id)
      .single();

    if (siteError || !site || !site.url) {
      console.error("Remediation site fetch error:", siteError);
      return NextResponse.json({ error: "Site configuration not found" }, { status: 404 });
    }

    const company_id = site.company_id;

    const { data: tokenData, error: tokenError } = await admin
      .from("site_tokens")
      .select("token_hash")
      .eq("site_id", site.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: "Site token not found" }, { status: 404 });
    }

    const siteUrl   = site.url.replace(/\/$/, "");
    const targetUrl = `${siteUrl}/wp-json/wpshield/v1/remediate`;

    // 2. Call the WordPress site — safeFetch blocks SSRF to private/internal IPs.
    const wpResponse = await safeFetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenData.token_hash}`,
      },
      body: JSON.stringify({ action, file_path }),
      signal: AbortSignal.timeout(10000),
    });

    const resultText = await wpResponse.text();
    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      return NextResponse.json({ error: "Invalid response from WordPress site", details: resultText }, { status: 500 });
    }

    if (!wpResponse.ok || !result.success) {
      return NextResponse.json({
        error: result.message || "Failed to remediate file on the site.",
        details: result
      }, { status: wpResponse.status });
    }

    let actionStr = "";
    if (action === "delete_file") actionStr = "Deleted malware file";
    else if (action === "quarantine_file") actionStr = "Quarantined malware file";

    // 3. Log the activity — wpshield_user_activity (the previous target) doesn't exist
    //    anywhere on the live database; this insert was failing silently every time
    //    (no error check on the original bare `await`). activity_logs is the real,
    //    already-displayed admin activity log (see lib/queries/activity.ts), and now
    //    that this route actually authenticates the caller, profile.id is a real actor
    //    to attribute the action to instead of the hardcoded "MSSP Analyst" placeholder.
    await logActivity(admin, profile.id, actionStr, company_id, {
      file_path,
      file_hash: file_hash || null,
      note: "A backup was automatically created on the server prior to this action",
    });

    // 4. Mark the file-integrity alert resolved — wpshield_fim_events (the previous
    //    target) doesn't exist either. File-integrity alerts actually live in the
    //    generic alerts table (see create_alert_from_file_event and the source_table
    //    filtering already used in app/api/cron/hardening-audit/route.ts), referencing
    //    the triggering row in wpshield_events_file via source_event_id. Resolve by
    //    finding that row via site_id + path (not just company_id — two sites under
    //    the same company could share an identical WordPress core file path), then
    //    resolving any open alert(s) that point back to it.
    if (file_hash) {
      const { data: fileEvents } = await admin
        .from("wpshield_events_file")
        .select("id")
        .eq("site_id", site.id)
        .eq("path", file_path);

      const eventIds = (fileEvents || []).map((e) => e.id);
      if (eventIds.length > 0) {
        await admin
          .from("alerts")
          .update({ status: "resolved", resolved_at: new Date().toISOString() })
          .eq("company_id", company_id)
          .eq("site_id", site.id)
          .eq("source_table", "wpshield_events_file")
          .in("source_event_id", eventIds);
      }
    }

    return NextResponse.json({ success: true, message: result.message });

  } catch (error: any) {
    // safeFetch throws on SSRF attempts — surface it clearly.
    if (error.message?.startsWith('SSRF Blocked')) {
      console.error("Remediation SSRF attempt blocked:", error.message);
      return NextResponse.json({ error: "Invalid site URL" }, { status: 400 });
    }
    console.error("Remediation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}