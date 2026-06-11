import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { spawn } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const profile = await getCurrentProfile(supabase);

    if (!profile || !profile.company_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = profile.company_id;

    const { searchParams } = new URL(request.url);
    const periodDays = parseInt(searchParams.get("period") || "30", 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);
    const startDateIso = startDate.toISOString();

    // 1. Fetch Company Info
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("display_name, site_url, last_seen_at")
      .eq("company_id", companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // 2. Fetch Stats counts
    const { count: attackCount } = await supabase
      .from("wpshield_events_attack")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("occurred_at", startDateIso);

    const { count: loginCount } = await supabase
      .from("wpshield_events_login")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("occurred_at", startDateIso);

    const { count: fileCount } = await supabase
      .from("wpshield_events_file")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("occurred_at", startDateIso);

    const { count: openAlertCount } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "open");

    // 3. Fetch Vulnerable Plugins
    const { data: vulnAlerts } = await supabase
      .from("wpshield_vuln_alerts")
      .select("plugin_name, plugin_version, cve_id, severity, fixed_in")
      .eq("company_id", companyId)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    // 4. Top 5 attacking IPs
    const { data: rawAttacks } = await supabase
      .from("wpshield_events_attack")
      .select("ip, pattern_type")
      .eq("company_id", companyId)
      .gte("occurred_at", startDateIso);

    const ipCounts = new Map<string, { ip: string; count: number; pattern_type: string }>();
    for (const att of (rawAttacks || [])) {
      if (!att.ip) continue;
      const existing = ipCounts.get(att.ip);
      if (existing) {
        existing.count++;
      } else {
        ipCounts.set(att.ip, { ip: att.ip, count: 1, pattern_type: att.pattern_type || "unknown" });
      }
    }
    const topAttackingIps = Array.from(ipCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 5. Recent 5 file changes
    const { data: fileChanges } = await supabase
      .from("wpshield_events_file")
      .select("path, event, occurred_at")
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false })
      .limit(5);

    // 6. Failed hardening checks
    const { data: failedChecks } = await supabase
      .from("wpshield_hardening_results")
      .select("check_name, priority, recommendation")
      .eq("company_id", companyId)
      .eq("status", "fail");

    // 7. Hardening score
    const { data: hardeningResults } = await supabase
      .from("wpshield_hardening_results")
      .select("status, score_impact")
      .eq("company_id", companyId);

    const score = (hardeningResults || []).reduce(
      (sum, c) => (c.status === "pass" ? sum + (c.score_impact || 0) : sum),
      0
    );

    const getMaturityLabel = (s: number) => {
      if (s <= 40) return "Critical Risk";
      if (s <= 60) return "Needs Attention";
      if (s <= 80) return "Moderate";
      if (s <= 90) return "Good";
      return "Excellent";
    };

    const periodLabel = `Last ${periodDays} Days`;

    const reportData = {
      company: {
        display_name: company.display_name,
        site_url: company.site_url,
        last_seen_at: company.last_seen_at || "",
      },
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      maturity: {
        score,
        label: getMaturityLabel(score),
      },
      stats: {
        totalAttacks: attackCount || 0,
        totalLogins: loginCount || 0,
        totalFileChanges: fileCount || 0,
        openAlerts: openAlertCount || 0,
      },
      vulnerablePlugins: vulnAlerts || [],
      topAttackingIps: topAttackingIps,
      recentFileChanges: fileChanges || [],
      failedChecks: failedChecks || [],
    };

    // Run Python script to generate styled Excel workbook
    const scriptPath = path.join(process.cwd(), "scripts", "generate_excel.py");

    const responseOrBuffer = await new Promise<Response | Buffer>((resolve) => {
      try {
        const chunks: Buffer[] = [];
        const errorChunks: Buffer[] = [];
        const pythonCmd = process.platform === "win32" ? "python" : "python3";
        const python = spawn(pythonCmd, [scriptPath], {
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
        });

        const killTimer = setTimeout(() => {
          python.kill("SIGKILL");
          console.error("[Excel Route] Python process killed after 30s timeout");
          resolve(new Response(
            JSON.stringify({ error: "Excel generation timed out after 30 seconds" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          ));
        }, 30000);
        
        python.stdout.on("data", (chunk) => {
          chunks.push(chunk);
        });
        
        python.stderr.on("data", (chunk) => {
          errorChunks.push(chunk);
        });
        
        python.on("close", (code) => {
          clearTimeout(killTimer);
          if (code !== 0) {
            const errorMsg = Buffer.concat(errorChunks).toString();
            console.error("[Excel Route] Python error:", errorMsg);
            resolve(new Response(
              JSON.stringify({ error: "Excel generation failed", details: errorMsg }), 
              { status: 500, headers: { "Content-Type": "application/json" }}
            ));
            return;
          }
          resolve(Buffer.concat(chunks));
        });

        python.on("error", (err) => {
          console.error("[Excel Route] Process spawn error:", err);
          resolve(new Response(
            JSON.stringify({ error: "Excel generation failed to spawn", details: err.message }), 
            { status: 500, headers: { "Content-Type": "application/json" }}
          ));
        });
        
        python.stdin.write(JSON.stringify(reportData));
        python.stdin.end();
      } catch (err: any) {
        console.error("[Excel Route] Spawn try/catch error:", err);
        resolve(new Response(
          JSON.stringify({ error: "Excel generation failed during setup", details: err.message }), 
          { status: 500, headers: { "Content-Type": "application/json" }}
        ));
      }
    });

    if (responseOrBuffer instanceof Response) {
      return responseOrBuffer;
    }

    const safeCompanyName = company.display_name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `security-data-${safeCompanyName}-${dateStr}.xlsx`;

    return new Response(new Uint8Array(responseOrBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error("Failed to generate Excel report:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
