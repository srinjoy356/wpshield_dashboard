import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";
// Give the background work up to 5 minutes on Render
export const maxDuration = 300;

function compareVersions(v1: string, v2: string): number {
  const cleanV1 = v1.replace(/[^0-9.-]/g, "");
  const cleanV2 = v2.replace(/[^0-9.-]/g, "");
  const parts1 = cleanV1.split(/[-.]/).map(p => parseInt(p, 10) || 0);
  const parts2 = cleanV2.split(/[-.]/).map(p => parseInt(p, 10) || 0);
  const maxLength = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLength; i++) {
    const val1 = parts1[i] ?? 0;
    const val2 = parts2[i] ?? 0;
    if (val1 < val2) return -1;
    if (val1 > val2) return 1;
  }
  return 0;
}

function isCveVulnerable(cveObj: any, slug: string, currentVersion: string): boolean {
  const configs = cveObj.configurations ?? [];
  let matchedCpe = false;
  let isVulnerable = false;

  for (const config of configs) {
    for (const node of config.nodes ?? []) {
      for (const match of node.cpeMatch ?? []) {
        if (!match.vulnerable) continue;
        const criteria = match.criteria ?? "";
        const parts = criteria.split(":");
        if (parts.length < 5) continue;
        const product = parts[4].toLowerCase();
        const slugNormalized = slug.toLowerCase().replace(/[-_]/g, "");
        const productNormalized = product.replace(/[-_]/g, "");
        if (productNormalized === slugNormalized || productNormalized.includes(slugNormalized) || slugNormalized.includes(productNormalized)) {
          matchedCpe = true;
          let startOk = true, endOk = true;
          if (match.versionStartIncluding) startOk = compareVersions(currentVersion, match.versionStartIncluding) >= 0;
          if (match.versionStartExcluding) startOk = startOk && compareVersions(currentVersion, match.versionStartExcluding) > 0;
          if (match.versionEndIncluding) endOk = compareVersions(currentVersion, match.versionEndIncluding) <= 0;
          if (match.versionEndExcluding) endOk = endOk && compareVersions(currentVersion, match.versionEndExcluding) < 0;
          if (!match.versionStartIncluding && !match.versionStartExcluding && !match.versionEndIncluding && !match.versionEndExcluding) {
            const cpeVersion = parts[5];
            if (cpeVersion !== "*" && cpeVersion !== "-") { if (cpeVersion === currentVersion) { isVulnerable = true; break; } }
            else { isVulnerable = true; break; }
          } else if (startOk && endOk) { isVulnerable = true; break; }
        }
      }
      if (isVulnerable) break;
    }
    if (isVulnerable) break;
  }

  if (!matchedCpe) {
    const descriptions = cveObj.descriptions ?? [];
    const enDesc = descriptions.find((d: any) => d.lang === "en")?.value ?? "";
    const lowerDesc = enDesc.toLowerCase();
    if (lowerDesc.includes("wordpress") && (lowerDesc.includes(slug.toLowerCase()) || lowerDesc.includes(slug.toLowerCase().replace("-", " ")))) {
      const upToMatch = lowerDesc.match(/(?:up to|through|including|before|prior to)\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
      if (upToMatch) { return compareVersions(currentVersion, upToMatch[1]) <= 0; }
      return true;
    }
  }
  return isVulnerable;
}

const SEVERITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
function highestSeverity(severities: string[]): string {
  let best = "low";
  for (const s of severities) {
    const key = s.toLowerCase();
    if ((SEVERITY_RANK[key] ?? 0) > (SEVERITY_RANK[best] ?? 0)) best = key;
  }
  return best;
}

async function runVulnCheck() {
  const supabase = createAdminClient();

  await supabase.from("alerts").delete().like("title", "Vulnerable plugin detected:%");

  const { data: companies } = await supabase.from("companies").select("*").eq("status", "active");
  if (!companies) return;

  for (const company of companies) {
    const companyId = company.company_id;

    const { data: snapshots } = await supabase
      .from("wpshield_inventory_snapshots")
      .select("*")
      .eq("company_id", companyId)
      .eq("kind", "plugins")
      .order("occurred_at", { ascending: false })
      .limit(1);

    if (!snapshots || snapshots.length === 0) continue;

    const payload = typeof snapshots[0].payload === "string" ? JSON.parse(snapshots[0].payload) : snapshots[0].payload;
    const plugins = Array.isArray(payload) ? payload : (payload?.plugins ?? []);
    if (plugins.length === 0) continue;

    const pluginVulnMap = new Map<string, { name: string; version: string; vulns: any[] }>();

    for (const plugin of plugins) {
      const isActive = plugin.is_active === true || plugin.is_active === 1 || plugin.is_active === "1";
      if (!isActive) continue;
      const { slug, version } = plugin;
      const name = plugin.name || slug;
      if (!slug || !version) continue;

      const foundVulnsMap = new Map<string, any>();

      // WPScan
      try {
        const wpRes = await fetch(`https://wpscan.com/api/v3/plugins/${slug}`, {
          headers: { "Authorization": `Token token=${process.env.WPSCAN_API_KEY}` },
          signal: AbortSignal.timeout(10000),
        });
        if (wpRes.ok) {
          const data = await wpRes.json();
          for (const vuln of data[slug]?.vulnerabilities ?? []) {
            const fixedIn = vuln.fixed_in || null;
            if (!fixedIn || compareVersions(version, fixedIn) < 0) {
              const vulnId = `wpscan-${vuln.id}`;
              const cveId = vuln.references?.cve?.[0] ?? null;
              const refUrl = vuln.references?.url?.[0] ?? `https://wpscan.com/vulnerability/${vuln.id}`;
              let cvssScore = null, severity = "medium";
              if (vuln.cvss?.score) {
                cvssScore = Number(vuln.cvss.score);
                if (cvssScore >= 9.0) severity = "critical";
                else if (cvssScore >= 7.0) severity = "high";
                else if (cvssScore >= 4.0) severity = "medium";
                else severity = "low";
              }
              foundVulnsMap.set(vulnId, { title: vuln.title, vulnId, severity, cvssScore, cveId, source: "wpscan", fixedIn, referenceUrl: refUrl });
            }
          }
        }
      } catch (err) { console.error(`WPScan failed for ${slug}:`, err); }

      // NVD
      try {
        const nvdRes = await fetch(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=wordpress+${encodeURIComponent(name)}&apiKey=4f53cadd-c7dd-48dc-b10e-bdd7752a6388`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (nvdRes.ok) {
          const data = await nvdRes.json();
          for (const item of data.vulnerabilities ?? []) {
            const cve = item.cve;
            if (!cve || !isCveVulnerable(cve, slug, version)) continue;
            const cveId = cve.id;
            if (Array.from(foundVulnsMap.values()).some(v => v.cveId === cveId)) continue;
            const title = cve.descriptions?.find((d: any) => d.lang === "en")?.value || cveId;
            const cvssData = cve.metrics?.cvssMetricV31?.[0]?.cvssData || cve.metrics?.cvssMetricV30?.[0]?.cvssData;
            const cvssScore = cvssData ? Number(cvssData.baseScore) : null;
            const severity = cvssData?.baseSeverity?.toLowerCase() || "medium";
            let fixedIn = null;
            outer: for (const config of cve.configurations ?? []) {
              for (const node of config.nodes ?? []) {
                for (const match of node.cpeMatch ?? []) {
                  if (match.vulnerable && match.versionEndExcluding) { fixedIn = match.versionEndExcluding; break outer; }
                }
              }
            }
            foundVulnsMap.set(cveId, { title, vulnId: cveId, severity, cvssScore, cveId, source: "nvd", fixedIn, referenceUrl: `https://nvd.nist.gov/vuln/detail/${cveId}` });
          }
        }
      } catch (err) { console.error(`NVD failed for ${name}:`, err); }

      // Save individual CVEs
      for (const vuln of Array.from(foundVulnsMap.values())) {
        const { data: existing } = await supabase.from("wpshield_vuln_alerts").select("id").eq("company_id", companyId).eq("vuln_id", vuln.vulnId).maybeSingle();
        if (!existing) {
          await supabase.from("wpshield_vuln_alerts").insert({
            company_id: companyId, plugin_slug: slug, plugin_name: name,
            plugin_version: version, vuln_title: vuln.title, vuln_id: vuln.vulnId,
            severity: vuln.severity, cvss_score: vuln.cvssScore, cve_id: vuln.cveId,
            source: vuln.source, fixed_in: vuln.fixedIn, reference_url: vuln.referenceUrl, status: "open"
          });
        }
      }

      if (foundVulnsMap.size > 0) {
        pluginVulnMap.set(slug, { name, version, vulns: Array.from(foundVulnsMap.values()) });
      }
    }

    // Grouped alert per plugin
    for (const [, pluginData] of Array.from(pluginVulnMap.entries())) {
      const { name, version, vulns } = pluginData;
      const alertTitle = `Vulnerable plugin detected: ${name}`;
      const { data: existing } = await supabase.from("alerts").select("id").eq("company_id", companyId).eq("title", alertTitle).eq("status", "open").maybeSingle();
      if (existing) continue;
      const topSeverity = highestSeverity(vulns.map(v => v.severity));
      const cveList = vulns.map(v => v.cveId).filter(Boolean).join(", ") || "No CVE IDs";
      const description = `${name} version ${version} has ${vulns.length} known vulnerabilit${vulns.length === 1 ? "y" : "ies"}. CVEs: ${cveList}. Update immediately.`;
      const { error: alertErr } = await supabase.from("alerts").insert({
        company_id: companyId, source_table: "wpshield_vuln_alerts", source_event_id: null,
        severity: topSeverity, title: alertTitle, description, status: "open",
      });
      if (!alertErr) {
        await sendAlertNotification({ company_id: companyId, alert_title: alertTitle, alert_description: description, severity: topSeverity, site_url: company.site_url });
      }
    }
  }
}

export async function GET(request: Request) {
  const secretHeader = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secretHeader !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Respond immediately so cron-job.org doesn't timeout
  // The actual work runs in the background on Render
  runVulnCheck().catch(err => console.error("vuln-check background error:", err));

  return NextResponse.json({ success: true, message: "Vuln check started in background" });
}