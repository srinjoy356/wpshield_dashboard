const fs = require('fs');
const crypto = require('crypto');

async function run() {
    console.log("Parsing .env.local...");
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const env = {};
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/"/g, '');
        }
    });

    const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
    const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error("Missing supabase credentials in .env.local");
        return;
    }

    const headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
    };

    console.log("Fetching the srinjoy356 site token from Supabase...");
    const resSites = await fetch(`${SUPABASE_URL}/rest/v1/sites?select=id,url,company_id&company_id=eq.srinjoy356&limit=1`, { headers });
    const sites = await resSites.json();
    const site = sites[0];

    if (!site) {
        console.error("No test_WP site found in Supabase.");
        return;
    }

    console.log(`Using site: ${site.url} (company: ${site.company_id})`);

    const rawToken = "test_waf_" + Date.now();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/site_tokens`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({
            site_id: site.id,
            token_hash: tokenHash,
            token_prefix: rawToken.substring(0, 8),
            created_at: new Date().toISOString()
        })
    });

    if (!insertRes.ok) {
        console.error("Failed to insert test token", await insertRes.text());
        return;
    }

    console.log("Sending simulated SQL Injection POST payload to /api/ingest/events...");
    
    const maliciousBody = Buffer.from("username=admin&password=1' OR '1'='1' UNION SELECT username, password FROM wp_users").toString("base64");
    
    const payload = {
        company_id: site.company_id,
        site_url: site.url,
        event_type: "attack",
        severity: "high",
        occurred_at: new Date().toISOString(),
        data: {
            pattern_type: "sqli",
            ip: "203.0.113.51",
            request_method: "POST",
            request_uri: "/wp-login.php",
            user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) sqlmap/1.4",
            request_body: maliciousBody
        }
    };

    const ingestRes = await fetch('http://localhost:3000/api/ingest/events', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rawToken}`
        },
        body: JSON.stringify(payload)
    });

    console.log("Status:", ingestRes.status);
    console.log("Response:", await ingestRes.text());
    
    console.log("Waiting 3 seconds for async WAF analysis to complete...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("Checking if IP '203.0.113.51' was banned in wpshield_blocked_ips...");
    const banCheck = await fetch(`${SUPABASE_URL}/rest/v1/wpshield_blocked_ips?ip=eq.203.0.113.51&company_id=eq.${site.company_id}&select=*`, { headers });
    const bans = await banCheck.json();
    
    if (bans.length > 0) {
        console.log("SUCCESS! The IP was automatically banned by the Coraza Engine:");
        console.dir(bans[0]);
    } else {
        console.log("FAILED. The IP was not found in wpshield_blocked_ips.");
    }
}

run().catch(console.error);
