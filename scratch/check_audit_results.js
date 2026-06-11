const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function getEnv(key) {
  try {
    const envPath = path.join(__dirname, "..", ".env.local");
    if (!fs.existsSync(envPath)) return null;
    const envFile = fs.readFileSync(envPath, "utf8");
    const lines = envFile.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith(`${key}=`)) {
        // Strip quotes if any
        return line.split("=")[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch (e) {
    console.error("Error reading env file:", e.message);
  }
  return null;
}

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResults() {
  console.log("=== Checking Audit & Log Tables ===");
  
  // 1. Hardening Results
  const { data: hardening, error: hErr } = await supabase
    .from("wpshield_hardening_results")
    .select("*");
  if (hErr) {
    console.error("Error wpshield_hardening_results:", hErr.message);
  } else {
    console.log(`\n[wpshield_hardening_results] Total rows: ${hardening.length}`);
    if (hardening.length > 0) {
      console.table(hardening.map(h => ({
        company: h.company_id,
        key: h.check_key,
        name: h.check_name,
        status: h.status,
        impact: h.score_impact,
        checked: h.last_checked_at
      })).slice(0, 10));
    }
  }

  // 2. Uptime Logs
  const { data: uptime, error: uErr } = await supabase
    .from("wpshield_uptime_logs")
    .select("*")
    .order("checked_at", { ascending: false })
    .limit(5);
  if (uErr) {
    console.error("Error wpshield_uptime_logs:", uErr.message);
  } else {
    console.log(`\n[wpshield_uptime_logs] (Latest 5 logs):`);
    if (uptime.length > 0) {
      console.table(uptime.map(u => ({
        company: u.company_id,
        url: u.site_url,
        status: u.status,
        ms: u.response_ms,
        code: u.status_code,
        checked: u.checked_at
      })));
    }
  }

  // 3. Vulnerability Alerts
  const { data: vulns, error: vErr } = await supabase
    .from("wpshield_vuln_alerts")
    .select("*")
    .limit(5);
  if (vErr) {
    console.error("Error wpshield_vuln_alerts:", vErr.message);
  } else {
    console.log(`\n[wpshield_vuln_alerts] Total rows: ${vulns.length}`);
    if (vulns.length > 0) {
      console.table(vulns.map(v => ({
        company: v.company_id,
        plugin: v.plugin_name,
        version: v.plugin_version,
        cve: v.cve_id,
        severity: v.severity,
        status: v.status
      })));
    }
  }

  // 4. Alerts
  const { data: alerts, error: aErr } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (aErr) {
    console.error("Error alerts:", aErr.message);
  } else {
    console.log(`\n[alerts] (Latest 10 alerts):`);
    if (alerts.length > 0) {
      console.table(alerts.map(a => ({
        id: a.id,
        company: a.company_id,
        source: a.source_table,
        severity: a.severity,
        title: a.title,
        status: a.status,
        created: a.created_at
      })));
    }
  }
}

checkResults();
