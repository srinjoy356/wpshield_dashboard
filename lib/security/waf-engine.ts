import { createWAF } from "@coraza/core";
import { createAdminClient } from "@/lib/supabase/admin";

// Create a singleton instance of the Coraza WAF Engine (Next.js Cache Buster 10)
let wafInstance: any = null;

// In-memory set of recently banned IPs to avoid duplicate Supabase inserts
// at high request volume. Evicted after 10 minutes per entry.
const recentlyBanned = new Set<string>();

export async function getWafEngine() {
  if (!wafInstance) {
    wafInstance = await createWAF({
      rules: `
        SecRuleEngine On
        SecRequestBodyAccess On
        SecResponseBodyAccess Off
        
        # Load CRS basic rules (Mocked/Simplified for now to prevent immediate false positives while we tune)
        SecRule ARGS|ARGS_NAMES|REQUEST_COOKIES|REQUEST_BODY|REQUEST_HEADERS:User-Agent|REQUEST_HEADERS:Referer "@rx (?:union|select|eval|base64_decode)" "id:10001,phase:2,deny,status:403,t:lowercase,msg:'Basic Injection Payload Detected'"
        SecRule REQUEST_URI "@rx (?:\\.\\./|\\.\\.\\\\|/etc/passwd|cmd\\.exe)" "id:10002,phase:1,deny,status:403,t:lowercase,msg:'Path Traversal / LFI Detected'"
        SecRule REQUEST_HEADERS:User-Agent "@rx (?:sqlmap|nikto|dirbuster|nmap|zmeu)" "id:10003,phase:1,deny,status:403,t:lowercase,msg:'Malicious Scanner Detected'"
      `
    });
  }
  return wafInstance;
}

/**
 * Asynchronously evaluates a payload originating from the WordPress plugin's Shadow WAF queue.
 * True Shadow WAF mode — called for every raw request forwarded by the WordPress plugin.
 * PHP does zero pattern matching. Coraza is the sole detector.
 * If a rule fires, the IP is auto-banned in Supabase and WordPress is notified immediately.
 */
export async function evaluateShadowPayload(
  companyId: string, 
  ipAddress: string, 
  method: string, 
  uri: string, 
  userAgent: string, 
  body: string
) {
  try {
    const waf = await getWafEngine();
    const transaction = waf.newTransaction();

    transaction.processConnection(ipAddress, 12345, 443);
    
    const bundleInterrupted = transaction.processRequestBundle({
      method: method,
      url: uri,
      protocol: "HTTP/1.1",
      headers: [
        ["user-agent", userAgent],
        ["host", "localhost"],
        ["content-type", "application/x-www-form-urlencoded"]
      ],
      remoteAddr: ipAddress
    }, body ? body : undefined);

    const isInterrupted = transaction.interruption();
    const rules = transaction.matchedRules();

    if (rules.length > 0) {
      const firstRuleId = rules[0].id;
      console.log(`[Shadow WAF] Malicious payload detected from IP: ${ipAddress} for company ${companyId}. Matched Rule: ${firstRuleId}`);
      
      const supabase = createAdminClient();

      // Fast in-memory dedup — avoids a Supabase SELECT on every single request
      // at high volume. The cache key includes company_id so multi-tenant is safe.
      const cacheKey = `${companyId}:${ipAddress}`;
      if (!recentlyBanned.has(cacheKey)) {
        recentlyBanned.add(cacheKey);
        // Evict after 10 minutes so a lifted ban can re-trigger if the attacker returns.
        setTimeout(() => recentlyBanned.delete(cacheKey), 10 * 60 * 1000);

        // Issue the ban in Supabase (upsert to handle any race conditions).
        const { error: insertErr } = await supabase.from("wpshield_blocked_ips").upsert({
          company_id: companyId,
          ip: ipAddress,
          reason: "Auto-Banned: WPShield Coraza Shadow WAF Detection",
          source: "shadow_waf",
          is_active: true,
          blocked_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() // 7 day ban
        }, { onConflict: "company_id,ip" });
        if (insertErr) console.error(`[WAF Supabase Insert Error] ${JSON.stringify(insertErr)}`);

        // Create an alert in the dashboard
        await supabase.from("alerts").insert({
          company_id: companyId,
          source_table: "wpshield_blocked_ips",
          severity: "high",
          title: "Attack blocked by Shadow WAF",
          description: `Automatically banned IP ${ipAddress} after detecting an injection payload.`,
          status: "open"
        });

        // Push the updated blocklist to WordPress immediately so the active blocker
        // enforces the ban in ~1 second rather than waiting for the next cache expiry.
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          await fetch(`${baseUrl}/api/purge-site-cache`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-wpshield-internal-secret': process.env.CRON_SECRET || 'secret',
            },
            body: JSON.stringify({ company_id: companyId, ip: ipAddress }),
            signal: AbortSignal.timeout(10000),
          });
          console.log(`[Shadow WAF] Cache purge triggered on WordPress for company ${companyId} after banning ${ipAddress}`);
        } catch (purgeErr) {
          console.error('[Shadow WAF] Cache purge call failed (non-fatal):', purgeErr);
        }
      }
    }
    
    transaction.processResponse({
      status: 200,
      protocol: "HTTP/1.1",
      headers: [["Content-Type", "text/plain"]]
    });
    transaction.processResponseBody();
    transaction.processLogging();
    transaction.close();

  } catch (error) {
    console.error("[Shadow WAF] Engine evaluation error:", error);
  }
}