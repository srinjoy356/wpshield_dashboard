import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertNotification } from "@/lib/notify";
import { getCheckTargets, type CheckTarget } from "@/lib/queries/site-targets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Secure route with x-cron-secret header check
    const secretHeader = request.headers.get("x-cron-secret");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET is not set" },
        { status: 500 }
      );
    }

    if (!secretHeader || secretHeader !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Fetch all active companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("*")
      .eq("status", "active");

    if (companiesError) {
      console.error("Error fetching active companies:", companiesError);
      return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    const results: any[] = [];

    // 3. Check one specific site (or, for a company that's never activated a site via a
    //    license yet, the legacy single companies.site_url — site_id is null in that
    //    case and status updates go to the companies row instead of a sites row).
    const checkOneSite = async (company: any, target: CheckTarget) => {
      const { site_id, url } = target;
      const displayName = company.display_name || company.company_id;

      let status: "up" | "down" = "up";
      let responseMs = 0;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "WPShield Uptime Monitor/1.0",
          },
          cache: "no-store",
        });

        responseMs = Date.now() - startTime;
        statusCode = response.status;

        if (response.status >= 500) {
          status = "down";
          errorMessage = `HTTP Status ${response.status}`;
        } else {
          status = "up";
        }
      } catch (err: any) {
        responseMs = Date.now() - startTime;
        status = "down";

        if (err.name === "AbortError") {
          errorMessage = "Timeout (10s)";
        } else {
          errorMessage = err.message || "Fetch failed";
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // 4. Record result in wpshield_uptime_logs
      const { data: logRecord, error: logError } = await supabase
        .from("wpshield_uptime_logs")
        .insert({
          company_id: company.company_id,
          site_id,
          site_url: url,
          status,
          response_ms: responseMs,
          status_code: statusCode,
          error_message: errorMessage,
          checked_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (logError) {
        console.error(`Failed to insert uptime log for ${company.company_id} (${url}):`, logError.message);
      }

      const logId = logRecord?.id || null;

      // For dedup/recovery comparisons, read this specific site's PREVIOUS status —
      // not the company's, which would be ambiguous across multiple sites.
      const previousStatus = site_id
        ? (await supabase.from("sites").select("uptime_status").eq("id", site_id).maybeSingle()).data?.uptime_status
        : company.uptime_status;

      // 5. Handle Alert Ingestion — title includes the specific URL so multiple sites
      //    under one company produce distinguishable alerts, not identical-looking ones.
      if (status === "down") {
        const alertTitle = `Site is down: ${url}`;

        let existingQuery = supabase
          .from("alerts")
          .select("id")
          .eq("company_id", company.company_id)
          .eq("title", alertTitle)
          .eq("status", "open");
        existingQuery = site_id ? existingQuery.eq("site_id", site_id) : existingQuery.is("site_id", null);
        const { data: existingAlert, error: alertCheckError } = await existingQuery.maybeSingle();

        if (alertCheckError) {
          console.error(`Error checking existing down alerts for ${company.company_id} (${url}):`, alertCheckError.message);
        }

        if (!existingAlert) {
          const timeString = new Date().toLocaleString("en-US", { timeZone: "UTC" }) + " UTC";
          const description = `Your WordPress site ${url} is not responding. Last checked: ${timeString}. Immediate action required.`;

          const { error: alertInsertError } = await supabase
            .from("alerts")
            .insert({
              company_id: company.company_id,
              site_id,
              source_table: "wpshield_uptime_logs",
              source_event_id: logId,
              severity: "critical",
              title: alertTitle,
              description,
              status: "open",
            });

          if (alertInsertError) {
            console.error(`Failed to insert critical down alert for ${company.company_id} (${url}):`, alertInsertError.message);
          }

          if (!alertInsertError) {
            await sendAlertNotification({
              company_id: company.company_id,
              alert_title: alertTitle,
              alert_description: description,
              severity: "critical",
              site_url: url,
            });
          }
        } else {
          console.log(`Open down alert already exists for ${company.company_id} (${url}). Skipping duplicate alert.`);
        }
      } else if (status === "up" && previousStatus === "down") {
        // Site comes back UP after being down
        const alertTitle = `Site is back online: ${url}`;
        const description = `Your WordPress site ${url} is back online. Response time: ${responseMs}ms.`;

        const { error: alertInsertError } = await supabase
          .from("alerts")
          .insert({
            company_id: company.company_id,
            site_id,
            source_table: "wpshield_uptime_logs",
            source_event_id: logId,
            severity: "high",
            title: alertTitle,
            description,
            status: "open",
          });

        if (alertInsertError) {
          console.error(`Failed to insert recovery alert for ${company.company_id} (${url}):`, alertInsertError.message);
        }

        if (!alertInsertError) {
          await sendAlertNotification({
            company_id: company.company_id,
            alert_title: alertTitle,
            alert_description: description,
            severity: "high",
            site_url: url,
          });
        }
      }

      // 6. Update the specific site's own uptime stats — or, for a company with no
      //    activated sites yet, fall back to the legacy companies row.
      if (site_id) {
        const { error: siteUpdateError } = await supabase
          .from("sites")
          .update({
            uptime_status: status,
            uptime_response_ms: responseMs,
            last_uptime_check: new Date().toISOString(),
          })
          .eq("id", site_id);
        if (siteUpdateError) {
          console.error(`Failed to update uptime status for site ${site_id}:`, siteUpdateError.message);
        }
      } else {
        const { error: companyUpdateError } = await supabase
          .from("companies")
          .update({
            uptime_status: status,
            uptime_response_ms: responseMs,
            last_uptime_check: new Date().toISOString(),
          })
          .eq("company_id", company.company_id);
        if (companyUpdateError) {
          console.error(`Failed to update uptime status for company ${company.company_id}:`, companyUpdateError.message);
        }
      }

      return {
        company_id: company.company_id,
        site_id,
        display_name: displayName,
        url,
        uptime_status: status,
        response_ms: responseMs,
        error_message: errorMessage,
      };
    };

    // 3b. For each company, check every active site under it. Companies that have
    //     never activated a site via a license yet fall back to the legacy single
    //     companies.site_url field, preserving existing behavior for them.
    const checkCompany = async (company: any) => {
      const targets = await getCheckTargets(supabase, company);

      if (targets.length === 0) {
        console.warn(`Company ${company.company_id} has no sites to check.`);
        return [];
      }

      return Promise.all(targets.map((t) => checkOneSite(company, t)));
    };

    // Run all checks concurrently across companies, then flatten the per-site results.
    const settleResults = await Promise.allSettled(companies.map((c) => checkCompany(c)));

    for (const res of settleResults) {
      if (res.status === "fulfilled" && res.value) {
        results.push(...res.value);
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error("Uptime check cron failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}