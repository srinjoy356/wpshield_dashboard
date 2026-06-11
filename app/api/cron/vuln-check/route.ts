import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertNotification } from "@/lib/notify";

// Force dynamic execution to prevent caching
export const dynamic = "force-dynamic";

/**
 * Normalizes version strings and compares them numerically.
 * Returns -1 if v1 < v2, 1 if v1 > v2, 0 if equal.
 */
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

/**
 * Checks if a specific CVE from NVD affects the active plugin version.
 */
function isCveVulnerable(cveObj: any, slug: string, currentVersion: string): boolean {
  const configs = cveObj.configurations ?? [];
  let matchedCpe = false;
  let isVulnerable = false;

  for (const config of configs) {
    const nodes = config.nodes ?? [];
    for (const node of nodes) {
      const cpeMatches = node.cpeMatch ?? [];
      for (const match of cpeMatches) {
        if (!match.vulnerable) continue;
        
        const criteria = match.criteria ?? "";
        const parts = criteria.split(":");
        if (parts.length < 5) continue;
        
        const product = parts[4].toLowerCase();
        const slugNormalized = slug.toLowerCase().replace(/[-_]/g, "");
        const productNormalized = product.replace(/[-_]/g, "");
        
        if (productNormalized === slugNormalized || productNormalized.includes(slugNormalized) || slugNormalized.includes(productNormalized)) {
          matchedCpe = true;
          
          let startOk = true;
          let endOk = true;
          
          if (match.versionStartIncluding) {
            startOk = startOk && compareVersions(currentVersion, match.versionStartIncluding) >= 0;
          }
          if (match.versionStartExcluding) {
            startOk = startOk && compareVersions(currentVersion, match.versionStartExcluding) > 0;
          }
          if (match.versionEndIncluding) {
            endOk = endOk && compareVersions(currentVersion, match.versionEndIncluding) <= 0;
          }
          if (match.versionEndExcluding) {
            endOk = endOk && compareVersions(currentVersion, match.versionEndExcluding) < 0;
          }
          
          if (!match.versionStartIncluding && !match.versionStartExcluding && !match.versionEndIncluding && !match.versionEndExcluding) {
            const cpeVersion = parts[5];
            if (cpeVersion !== "*" && cpeVersion !== "-") {
              if (cpeVersion === currentVersion) {
                isVulnerable = true;
                break;
              }
            } else {
              isVulnerable = true;
              break;
            }
          } else if (startOk && endOk) {
            isVulnerable = true;
            break;
          }
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
    
    const hasWordpress = lowerDesc.includes("wordpress");
    const hasSlug = lowerDesc.includes(slug.toLowerCase()) || lowerDesc.includes(slug.toLowerCase().replace("-", " "));
    
    if (hasWordpress && hasSlug) {
      const upToMatch = lowerDesc.match(/(?:up to|through|including|before|prior to)\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
      if (upToMatch) {
        const detectedVer = upToMatch[1];
        if (compareVersions(currentVersion, detectedVer) <= 0) {
          return true;
        }
      } else {
        return true;
      }
    }
  }

  return isVulnerable;
}

/** Severity ranking for finding the highest across multiple CVEs */
const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function highestSeverity(severities: string[]): string {
  let best = "low";
  for (const s of severities) {
    const key = s.toLowerCase();
    if ((SEVERITY_RANK[key] ?? 0) > (SEVERITY_RANK[best] ?? 0)) {
      best = key;
    }
  }
  return best;
}

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

    // 2. One-time cleanup: remove stale per-CVE duplicate alerts in public.alerts
    //    (old logic created one alert per CVE — now we do one per plugin)
    const { error: cleanupError } = await supabase
      .from("alerts")
      .delete()
      .like("title", "Vulnerable plugin detected:%");

    if (cleanupError) {
      console.warn("Cleanup of old vuln alerts had an issue:", cleanupError.message);
    }

    // 3. Read all active companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("*")
      .eq("status", "active");

    if (companiesError) {
      console.error("Error fetching active companies:", companiesError);
      return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
    }

    const summary: Record<string, number> = {};

    // 4. For each active company, retrieve latest inventory snapshot (kind = 'plugins')
    for (const company of companies) {
      const companyId = company.company_id;
      summary[companyId] = 0;

      const { data: snapshots, error: snapshotError } = await supabase
        .from("wpshield_inventory_snapshots")
        .select("*")
        .eq("company_id", companyId)
        .eq("kind", "plugins")
        .order("occurred_at", { ascending: false })
        .limit(1);

      if (snapshotError) {
        console.error(`Error fetching snapshot for company ${companyId}:`, snapshotError);
        continue;
      }

      if (!snapshots || snapshots.length === 0) continue;

      const snapshot = snapshots[0];
      const payload = typeof snapshot.payload === "string" ? JSON.parse(snapshot.payload) : snapshot.payload;
      const plugins = Array.isArray(payload)
        ? payload
        : (payload?.plugins && Array.isArray(payload.plugins) ? payload.plugins : []);

      if (plugins.length === 0) continue;

      // Collect all vulns per plugin — keyed by slug
      // Map: slug => { name, version, vulns[] }
      const pluginVulnMap = new Map<string, {
        name: string;
        version: string;
        vulns: Array<{
          title: string;
          vulnId: string;
          severity: string;
          cvssScore: number | null;
          cveId: string | null;
          source: string;
          fixedIn: string | null;
          referenceUrl: string;
        }>;
      }>();

      // Check each active plugin
      for (const plugin of plugins) {
        const isActive = plugin.is_active === true || plugin.is_active === 1 || plugin.is_active === "1";
        if (!isActive) continue;

        const slug = plugin.slug;
        const name = plugin.name || slug;
        const version = plugin.version;
        if (!slug || !version) continue;

        const foundVulnsMap = new Map<string, {
          title: string;
          vulnId: string;
          severity: string;
          cvssScore: number | null;
          cveId: string | null;
          source: string;
          fixedIn: string | null;
          referenceUrl: string;
        }>();

        // A. WPScan API lookup
        try {
          const wpscanUrl = `https://wpscan.com/api/v3/plugins/${slug}`;
          const wpResponse = await fetch(wpscanUrl, {
            headers: {
              "Authorization": `Token token=${process.env.WPSCAN_API_KEY}`
            }
          });
          
          if (wpResponse.ok) {
            const data = await wpResponse.json();
            const pluginData = data[slug];
            if (pluginData && Array.isArray(pluginData.vulnerabilities)) {
              for (const vuln of pluginData.vulnerabilities) {
                const fixedIn = vuln.fixed_in || null;
                const isVuln = !fixedIn || compareVersions(version, fixedIn) < 0;
                
                if (isVuln) {
                  const vulnId = `wpscan-${vuln.id}`;
                  const cveId = Array.isArray(vuln.references?.cve) && vuln.references.cve.length > 0
                    ? vuln.references.cve[0] : null;
                  const refUrl = Array.isArray(vuln.references?.url) && vuln.references.url.length > 0
                    ? vuln.references.url[0] : `https://wpscan.com/vulnerability/${vuln.id}`;
                  
                  let cvssScore: number | null = null;
                  let severity = "medium";
                  if (vuln.cvss?.score) {
                    const parsedScore = Number(vuln.cvss.score);
                    if (!isNaN(parsedScore)) {
                      cvssScore = parsedScore;
                      if (parsedScore >= 9.0) severity = "critical";
                      else if (parsedScore >= 7.0) severity = "high";
                      else if (parsedScore >= 4.0) severity = "medium";
                      else severity = "low";
                    }
                  }

                  foundVulnsMap.set(vulnId, { title: vuln.title, vulnId, severity, cvssScore, cveId, source: "wpscan", fixedIn, referenceUrl: refUrl });
                }
              }
            }
          } else {
            console.warn(`WPScan API returned status ${wpResponse.status} for plugin slug: ${slug}`);
          }
        } catch (err) {
          console.error(`WPScan API lookup failed for slug ${slug}:`, err);
        }

        // B. NVD API lookup
        try {
          const encodedName = encodeURIComponent(name);
          const nvdUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=wordpress+${encodedName}&apiKey=4f53cadd-c7dd-48dc-b10e-bdd7752a6388`;
          const nvdResponse = await fetch(nvdUrl);
          
          if (nvdResponse.ok) {
            const data = await nvdResponse.json();
            const vulnerabilities = data.vulnerabilities ?? [];
            
            for (const item of vulnerabilities) {
              const cve = item.cve;
              if (!cve) continue;

              if (isCveVulnerable(cve, slug, version)) {
                const vulnId = cve.id;
                const cveId = cve.id;
                const refUrl = Array.isArray(cve.references) && cve.references.length > 0
                  ? cve.references[0].url : `https://nvd.nist.gov/vuln/detail/${cve.id}`;
                
                const descriptions = cve.descriptions ?? [];
                const title = descriptions.find((d: any) => d.lang === "en")?.value || cve.id;
                
                let cvssScore = null;
                let severity = "medium";
                const cvssData = cve.metrics?.cvssMetricV31?.[0]?.cvssData || cve.metrics?.cvssMetricV30?.[0]?.cvssData;
                if (cvssData) {
                  cvssScore = Number(cvssData.baseScore) || null;
                  severity = cvssData.baseSeverity?.toLowerCase() || "medium";
                }

                let fixedIn = null;
                const configs = cve.configurations ?? [];
                for (const config of configs) {
                  for (const node of config.nodes ?? []) {
                    for (const match of node.cpeMatch ?? []) {
                      if (match.vulnerable && match.versionEndExcluding) {
                        fixedIn = match.versionEndExcluding;
                        break;
                      }
                    }
                    if (fixedIn) break;
                  }
                  if (fixedIn) break;
                }

                // Avoid duplicate if WPScan already has this CVE
                const isDuplicate = Array.from(foundVulnsMap.values()).some(v => v.cveId === cveId);
                if (!isDuplicate) {
                  foundVulnsMap.set(vulnId, { title, vulnId, severity, cvssScore, cveId, source: "nvd", fixedIn, referenceUrl: refUrl });
                }
              }
            }
          } else {
            console.warn(`NVD API returned status ${nvdResponse.status} for plugin: ${name}`);
          }
        } catch (err) {
          console.error(`NVD API lookup failed for plugin ${name}:`, err);
        }

        // C. Commit individual CVEs to wpshield_vuln_alerts (unchanged — fine-grained data)
        for (const vuln of Array.from(foundVulnsMap.values())) {
          const { data: existingAlert } = await supabase
            .from("wpshield_vuln_alerts")
            .select("id")
            .eq("company_id", companyId)
            .eq("vuln_id", vuln.vulnId)
            .maybeSingle();

          if (!existingAlert) {
            await supabase.from("wpshield_vuln_alerts").insert({
              company_id: companyId,
              plugin_slug: slug,
              plugin_name: name,
              plugin_version: version,
              vuln_title: vuln.title,
              vuln_id: vuln.vulnId,
              severity: vuln.severity,
              cvss_score: vuln.cvssScore,
              cve_id: vuln.cveId,
              source: vuln.source,
              fixed_in: vuln.fixedIn,
              reference_url: vuln.referenceUrl,
              status: "open"
            });
          }
        }

        // Accumulate vulns per plugin for grouped alert creation
        if (foundVulnsMap.size > 0) {
          pluginVulnMap.set(slug, {
            name,
            version,
            vulns: Array.from(foundVulnsMap.values()),
          });
          summary[companyId] += foundVulnsMap.size;
        }
      }

      // D. Create ONE alert per vulnerable plugin (grouped)
      for (const [slug, pluginData] of Array.from(pluginVulnMap.entries())) {
        const { name, version, vulns } = pluginData;
        const alertTitle = `Vulnerable plugin detected: ${name}`;

        // Skip if an open alert for this plugin + company already exists
        const { data: existingPluginAlert } = await supabase
          .from("alerts")
          .select("id")
          .eq("company_id", companyId)
          .eq("title", alertTitle)
          .eq("status", "open")
          .maybeSingle();

        if (existingPluginAlert) {
          console.log(`Alert for plugin "${name}" already exists — skipping`);
          continue;
        }

        const topSeverity = highestSeverity(vulns.map(v => v.severity));
        const cveList = vulns
          .map(v => v.cveId)
          .filter(Boolean)
          .join(", ") || "No CVE IDs";

        const description = `${name} version ${version} has ${vulns.length} known vulnerabilit${vulns.length === 1 ? "y" : "ies"}. CVEs: ${cveList}. Update to latest version immediately.`;

        const { error: alertInsertError } = await supabase.from("alerts").insert({
          company_id: companyId,
          source_table: "wpshield_vuln_alerts",
          source_event_id: null,
          severity: topSeverity,
          title: alertTitle,
          description,
          status: "open",
        });

        if (alertInsertError) {
          console.error(`Failed to create grouped alert for plugin "${name}":`, alertInsertError);
        }

        if (!alertInsertError) {
          await sendAlertNotification({
            company_id: companyId,
            alert_title: alertTitle,
            alert_description: description,
            severity: topSeverity,
            site_url: company.site_url,
          });
        }
      }
    }

    return NextResponse.json({ success: true, summary });

  } catch (error: any) {
    console.error("Vulnerability check cron error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
