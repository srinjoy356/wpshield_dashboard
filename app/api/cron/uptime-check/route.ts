import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertNotification } from "@/lib/notify";

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

    const results = [];

    // 3. Define concurrent check function
    const checkCompany = async (company: any) => {
      const companyId = company.company_id;
      const siteUrl = company.site_url;
      const displayName = company.display_name || companyId;

      if (!siteUrl) {
        console.warn(`Company ${companyId} has no site_url configured.`);
        return null;
      }

      let status: "up" | "down" = "up";
      let responseMs = 0;
      let statusCode: number | null = null;
      let errorMessage: string | null = null;

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(siteUrl, {
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
          company_id: companyId,
          site_url: siteUrl,
          status,
          response_ms: responseMs,
          status_code: statusCode,
          error_message: errorMessage,
          checked_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (logError) {
        console.error(`Failed to insert uptime log for ${companyId}:`, logError.message);
      }

      const logId = logRecord?.id || null;

      // 5. Handle Alert Ingestion
      if (status === "down") {
        const alertTitle = `Site is down: ${displayName}`;

        // Check if an open down alert already exists for this company
        const { data: existingAlert, error: alertCheckError } = await supabase
          .from("alerts")
          .select("id")
          .eq("company_id", companyId)
          .eq("title", alertTitle)
          .eq("status", "open")
          .maybeSingle();

        if (alertCheckError) {
          console.error(`Error checking existing down alerts for ${companyId}:`, alertCheckError.message);
        }

        if (!existingAlert) {
          const timeString = new Date().toLocaleString("en-US", { timeZone: "UTC" }) + " UTC";
          const description = `Your WordPress site ${siteUrl} is not responding. Last checked: ${timeString}. Immediate action required.`;

          const { error: alertInsertError } = await supabase
            .from("alerts")
            .insert({
              company_id: companyId,
              source_table: "wpshield_uptime_logs",
              source_event_id: logId,
              severity: "critical",
              title: alertTitle,
              description,
              status: "open",
            });

          if (alertInsertError) {
            console.error(`Failed to insert critical down alert for ${companyId}:`, alertInsertError.message);
          }

          // Trigger live notifications if alert creation was successful
          if (!alertInsertError) {
            await sendAlertNotification({
              company_id: companyId,
              alert_title: alertTitle,
              alert_description: description,
              severity: "critical",
              site_url: siteUrl,
            });
          }
        } else {
          console.log(`Open down alert already exists for ${companyId}. Skipping duplicate alert.`);
        }
      } else if (status === "up" && company.uptime_status === "down") {
        // Site comes back UP after being down
        const alertTitle = `Site is back online: ${displayName}`;
        const description = `Your WordPress site ${siteUrl} is back online. Response time: ${responseMs}ms.`;

        const { error: alertInsertError } = await supabase
          .from("alerts")
          .insert({
            company_id: companyId,
            source_table: "wpshield_uptime_logs",
            source_event_id: logId,
            severity: "high",
            title: alertTitle,
            description,
            status: "open",
          });

        if (alertInsertError) {
          console.error(`Failed to insert recovery alert for ${companyId}:`, alertInsertError.message);
        }

        // Trigger live notifications if recovery alert creation was successful
        if (!alertInsertError) {
          await sendAlertNotification({
            company_id: companyId,
            alert_title: alertTitle,
            alert_description: description,
            severity: "high",
            site_url: siteUrl,
          });
        }
      }

      // 6. Update companies table with current uptime stats
      const { error: companyUpdateError } = await supabase
        .from("companies")
        .update({
          uptime_status: status,
          uptime_response_ms: responseMs,
          last_uptime_check: new Date().toISOString(),
        })
        .eq("company_id", companyId);

      if (companyUpdateError) {
        console.error(`Failed to update uptime status for company ${companyId}:`, companyUpdateError.message);
      }

      return {
        company_id: companyId,
        display_name: displayName,
        uptime_status: status,
        response_ms: responseMs,
        error_message: errorMessage,
      };
    };

    // Run all checks concurrently
    const promises = companies.map((c) => checkCompany(c));
    const settleResults = await Promise.allSettled(promises);

    for (const res of settleResults) {
      if (res.status === "fulfilled" && res.value) {
        results.push(res.value);
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error("Uptime check cron failed:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}