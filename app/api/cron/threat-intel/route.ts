import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Secure route with x-cron-secret header check
    const secretHeader = request.headers.get("x-cron-secret");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET is not set" },
        { status: 500 },
      );
    }

    if (!secretHeader || secretHeader !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Query wpshield_events_attack table for the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: attacks, error: queryError } = await supabase
      .from("wpshield_events_attack")
      .select("ip, company_id, site_id")
      .gte("occurred_at", twentyFourHoursAgo.toISOString());

    if (queryError) {
      console.error("Error querying attack events:", queryError);
      return NextResponse.json(
        { error: "Failed to query attack events" },
        { status: 500 },
      );
    }

    // 3. Group by IP to find those attacking >= 2 different company_ids. Also track
    //    which site_id(s) within each company took the hits, so the alert created
    //    below can point at the specific site rather than just the company — when an
    //    IP hits more than one site under the same company, attribute to whichever was
    //    hit the most (a reasonable simplification rather than splitting one IP's
    //    cross-network alert into per-site duplicates).
    const ipMap = new Map<string, Map<string, Map<string | null, number>>>(); // ip -> company_id -> site_id -> count

    for (const attack of attacks || []) {
      const { ip, company_id, site_id } = attack as {
        ip: string;
        company_id: string;
        site_id: string | null;
      };
      if (!ip || !company_id) continue;

      if (!ipMap.has(ip)) ipMap.set(ip, new Map());
      const companyMap = ipMap.get(ip)!;
      if (!companyMap.has(company_id)) companyMap.set(company_id, new Map());
      const siteMap = companyMap.get(company_id)!;
      siteMap.set(site_id, (siteMap.get(site_id) || 0) + 1);
    }

    const flaggedIps: any[] = [];
    const alertedCompanies = new Set<string>();

    ipMap.forEach((companyMap, ip) => {
      if (companyMap.size >= 2) {
        let totalAttacks = 0;
        const companiesInfo: Array<{
          company_id: string;
          count: number;
          site_id: string | null;
        }> = [];

        companyMap.forEach((siteMap, company_id) => {
          let count = 0;
          let topSiteId: string | null = null;
          let topSiteCount = -1;
          siteMap.forEach((siteCount, siteId) => {
            count += siteCount;
            if (siteCount > topSiteCount) {
              topSiteCount = siteCount;
              topSiteId = siteId;
            }
          });
          totalAttacks += count;
          companiesInfo.push({ company_id, count, site_id: topSiteId });
        });

        flaggedIps.push({
          ip,
          companies: companiesInfo,
          totalAttacks,
        });
      }
    });

    // 4. Create alerts for affected companies of flagged IPs
    for (const threat of flaggedIps) {
      const { ip, companies: companiesInfo, totalAttacks } = threat;
      const commaSeparatedCompanies = companiesInfo
        .map((c: any) => c.company_id)
        .join(", ");

      for (const compInfo of companiesInfo) {
        // Check if an open alert already exists with title like 'Cross-site threat: IP %{ip}%'
        let existingQuery = supabase
          .from("alerts")
          .select("id")
          .eq("company_id", compInfo.company_id)
          .eq("status", "open")
          .like("title", `%Cross-site threat%${ip}%`);
        existingQuery = compInfo.site_id
          ? existingQuery.eq("site_id", compInfo.site_id)
          : existingQuery.is("site_id", null);
        const { data: existingAlert } = await existingQuery.maybeSingle();

        if (existingAlert) {
          console.log(
            `Alert already exists for company ${compInfo.company_id} and IP ${ip}. Skipping.`,
          );
          continue;
        }

        const alertTitle = `Cross-site threat detected: ${ip}`;
        const description = `IP address ${ip} has been detected attacking ${companiesInfo.length} sites in the WPShield network in the last 24 hours. This IP is part of a coordinated attack campaign. Affected sites: ${commaSeparatedCompanies}. Total attacks from this IP: ${totalAttacks}.`;

        const { error: insertError } = await supabase.from("alerts").insert({
          company_id: compInfo.company_id,
          site_id: compInfo.site_id,
          severity: "high",
          title: alertTitle,
          description,
          status: "open",
          source_table: "wpshield_events_attack",
        });

        if (insertError) {
          console.error(
            `Failed to insert alert for company ${compInfo.company_id} regarding IP ${ip}:`,
            insertError.message,
          );
        } else {
          alertedCompanies.add(compInfo.company_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      threatIpsFound: flaggedIps.length,
      flaggedIps: flaggedIps.map((f) => f.ip),
      companiesAlerted: Array.from(alertedCompanies),
    });
  } catch (error: any) {
    console.error("Threat intelligence cron error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}