import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { logActivity } from "@/lib/activity";
import { safeFetch } from "@/lib/security/ssrf";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const profile = await getCurrentProfile(supabase);
    // Allow users with a valid company to update their own plugins
    if (!profile || !profile.company_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { site_id, plugin_slug } = body;

    if (!site_id || !plugin_slug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify site belongs to user's company
    const { data: site, error: siteError } = await admin
      .from("sites")
      .select("id, url, company_id")
      .eq("id", site_id)
      .single();

    if (siteError || !site || !site.url) {
      return NextResponse.json({ error: "Site configuration not found" }, { status: 404 });
    }

    if (site.company_id !== profile.company_id) {
       return NextResponse.json({ error: "Unauthorized access to site" }, { status: 403 });
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

    const siteUrl = site.url.replace(/\/$/, "");
    const targetUrl = `${siteUrl}/wp-json/wpshield/v1/remediate`;

    const wpResponse = await safeFetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${tokenData.token_hash}`,
      },
      body: JSON.stringify({ action: "update_plugin", plugin_slug }),
      signal: AbortSignal.timeout(30000), // longer timeout for plugin updates
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
        error: result.message || "Failed to update plugin on the site.",
        details: result
      }, { status: wpResponse.status });
    }

    await logActivity(admin, profile.id, `Triggered plugin update for ${plugin_slug}`, profile.company_id, {
      site_id: site.id,
      site_url: site.url,
      plugin_slug,
    });

    return NextResponse.json({ success: true, message: "Plugin update triggered" });
  } catch (error: any) {
    console.error("Plugin update error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
