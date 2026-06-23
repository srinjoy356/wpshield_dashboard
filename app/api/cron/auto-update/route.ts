import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeFetch } from "@/lib/security/ssrf";
import { getLatestInventoryByKind } from "@/lib/queries/events";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  try {
    const admin = createAdminClient();

    // Fetch all companies with auto_update_plugins enabled
    const { data: companies, error: companiesError } = await admin
      .from("companies")
      .select("company_id")
      .eq("auto_update_plugins", true)
      .eq("status", "active");

    if (companiesError || !companies) {
      console.error("Auto-update cron failed to fetch companies", companiesError);
      return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    if (companies.length === 0) {
      return NextResponse.json({ message: "No companies with auto-update enabled" });
    }

    const companyIds = companies.map(c => c.company_id);

    // Fetch all active sites for these companies
    const { data: sites, error: sitesError } = await admin
      .from("sites")
      .select("id, url, company_id")
      .in("company_id", companyIds);

    if (sitesError || !sites) {
      console.error("Auto-update cron failed to fetch sites", sitesError);
      return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
    }

    let updatesTriggered = 0;

    for (const site of sites) {
      // Get site token
      const { data: tokenData } = await admin
        .from("site_tokens")
        .select("token_hash")
        .eq("site_id", site.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!tokenData) continue;

      // Get latest inventory
      const inventory = await getLatestInventoryByKind(admin, site.company_id, site.id);
      if (!inventory) continue;

      const pluginsToUpdate = inventory.plugins.filter((p: any) => p.update_pending);
      if (pluginsToUpdate.length === 0) continue;

      const siteUrl = site.url.replace(/\/$/, "");
      const targetUrl = `${siteUrl}/wp-json/wpshield/v1/remediate`;

      for (const plugin of pluginsToUpdate) {
        try {
          const wpResponse = await safeFetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${tokenData.token_hash}`,
            },
            body: JSON.stringify({ action: "update_plugin", plugin_slug: plugin.file }),
            signal: AbortSignal.timeout(30000),
          });

          const resultText = await wpResponse.text();
          let result;
          try {
            result = JSON.parse(resultText);
          } catch {
            // Ignore invalid json responses
            continue;
          }

          if (wpResponse.ok && result.success) {
            updatesTriggered++;
            await logActivity(admin, "system", `Auto-updated plugin ${plugin.slug}`, site.company_id, {
              site_id: site.id,
              site_url: site.url,
              plugin_slug: plugin.slug,
              action: "auto_update_plugin"
            });
          }
        } catch (error) {
          console.error(`Failed to auto-update ${plugin.slug} on ${site.url}`, error);
        }
      }
    }

    return NextResponse.json({ success: true, message: `Auto-update cron completed. Triggered ${updatesTriggered} updates.` });
  } catch (error: any) {
    console.error("Auto-update cron error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
