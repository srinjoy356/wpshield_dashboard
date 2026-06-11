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

    console.log("Fetching a site token from Supabase...");
    const resSites = await fetch(`${SUPABASE_URL}/rest/v1/sites?select=id,url,company_id&limit=1`, { headers });
    const sites = await resSites.json();
    const site = sites[0];

    if (!site) {
        console.error("No site found in Supabase. Please ensure there is at least one site.");
        return;
    }

    console.log(`Using site: ${site.url} (company: ${site.company_id})`);

    const rawToken = "test_inv_" + Date.now();
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

    console.log("Sending simulated INVENTORY payload to /api/ingest/inventory...");
    const payload = {
        site_url: site.url,
        kind: "plugins",
        data: {
            count: 3,
            plugins: [
                {
                    name: "API Test Plugin",
                    slug: "api-test-plugin",
                    version: "1.0.0",
                    is_active: true,
                    update_pending: false
                }
            ]
        }
    };

    const ingestRes = await fetch('http://localhost:3000/api/ingest/inventory', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rawToken}`
        },
        body: JSON.stringify(payload)
    });

    console.log("Status:", ingestRes.status);
    console.log("Response:", await ingestRes.text());
}

run().catch(console.error);
