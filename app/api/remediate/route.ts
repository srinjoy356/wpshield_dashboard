import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeFetch } from "@/lib/security/ssrf";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, company_id, file_path, file_hash } = body;

    if (!action || !company_id || !file_path) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Get site configuration (URL and Token Hash)
    const { data: site, error: siteError } = await admin
      .from("sites")
      .select("id, url")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (siteError || !site || !site.url) {
      console.error("Remediation site fetch error:", siteError);
      return NextResponse.json({ error: "Site configuration not found" }, { status: 404 });
    }

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

    // 3. Log the activity
    let actionStr = "";
    if (action === "delete_file") actionStr = "Deleted malware file";
    else if (action === "quarantine_file") actionStr = "Quarantined malware file";

    await admin.from("wpshield_user_activity").insert({
      company_id,
      user_name: "MSSP Analyst",
      user_email: "analyst@mssp.com",
      action: actionStr,
      details: `${actionStr}: ${file_path} (A backup was automatically created on the server prior to this action)`,
      ip_address: "Dashboard",
    });

    // 4. Update the FIM alert status to resolved
    if (file_hash) {
      await admin
        .from("wpshield_fim_events")
        .update({ status: "resolved" })
        .eq("company_id", company_id)
        .eq("file_path", file_path);
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