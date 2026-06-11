import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

const THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
];

export async function GET(request: Request) {
  try {
    // 1. Auth
    const secret = request.headers.get("x-cron-secret");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
    return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET is not set" },
        { status: 500 }
    );
    }
    if (!secret || secret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_SAFE_BROWSING_KEY not configured" },
        { status: 500 }
      );
    }

    const supabase = createAdminClient();

    // 2. Fetch all active companies with a site_url
    const { data: companies, error } = await supabase
      .from("companies")
      .select("company_id, display_name, site_url, safebrowsing_status")
      .eq("status", "active")
      .not("site_url", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({ success: true, checked: 0 });
    }

    const results = await Promise.all(
    companies.map(async (company) => {
        const siteUrl = company.site_url;
        if (!siteUrl) return null;

        let status: "clean" | "blacklisted" | "unknown" = "unknown";

        try {
        const sbAbort = new AbortController();
        const sbTimeout = setTimeout(() => sbAbort.abort(), 10000);

        const res = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
            {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client: {
                clientId: "wpshield-cybernara",
                clientVersion: "2.0.0",
                },
                threatInfo: {
                threatTypes: THREAT_TYPES,
                platformTypes: ["ANY_PLATFORM"],
                threatEntryTypes: ["URL"],
                threatEntries: [{ url: siteUrl }],
                },
            }),
            signal: sbAbort.signal,
            }
        ).finally(() => clearTimeout(sbTimeout));

        if (!res.ok) {
            console.error(
            `[safe-browsing] API error for ${company.company_id}:`,
            res.status,
            await res.text()
            );
            status = "unknown";
        } else {
            const data = await res.json();
            status =
            data.matches && data.matches.length > 0 ? "blacklisted" : "clean";
        }
        } catch (err: any) {
        console.error(
            `[safe-browsing] fetch failed for ${company.company_id}:`,
            err.message
        );
        status = "unknown";
        }

        // Update companies table
        await supabase
        .from("companies")
        .update({
            safebrowsing_status: status,
            last_safebrowsing_check: new Date().toISOString(),
        })
        .eq("company_id", company.company_id);

        // If blacklisted — create alert
        if (status === "blacklisted") {
        const alertTitle = "Site blacklisted by Google Safe Browsing";

        const { data: existing } = await supabase
            .from("alerts")
            .select("id")
            .eq("company_id", company.company_id)
            .eq("title", alertTitle)
            .eq("status", "open")
            .maybeSingle();

        if (!existing) {
            const description = `${siteUrl} has been flagged by Google Safe Browsing as containing malware, phishing, or unwanted software. Visitors using Chrome, Firefox, or Safari will see a warning page. Immediate action is required.`;

            await supabase.from("alerts").insert({
            company_id: company.company_id,
            source_table: "companies",
            source_event_id: null,
            severity: "critical",
            title: alertTitle,
            description,
            status: "open",
            });

            await sendAlertNotification({
            company_id: company.company_id,
            alert_title: alertTitle,
            alert_description: description,
            severity: "critical",
            site_url: siteUrl,
            });
        }
        }

        // If previously blacklisted and now clean — recovery alert
        if (status === "clean" && company.safebrowsing_status === "blacklisted") {
        await supabase.from("alerts").insert({
            company_id: company.company_id,
            source_table: "companies",
            source_event_id: null,
            severity: "medium",
            title: "Site removed from Google Safe Browsing blacklist",
            description: `${siteUrl} has been cleared from Google Safe Browsing. The site is no longer flagged as dangerous.`,
            status: "open",
        });
        }

        console.log(`[safe-browsing] ${company.company_id} → ${status}`);

        return {
        company_id: company.company_id,
        site_url: siteUrl,
        status,
        };
    })
    );

    // Filter out nulls from skipped entries
    const filteredResults = results.filter(Boolean);

    return NextResponse.json({ success: true, results: filteredResults });
  } catch (err: any) {
    console.error("[safe-browsing] cron failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}