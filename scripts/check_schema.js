const fs = require('fs');

async function run() {
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
    const headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
    };

    const resLic = await fetch(`${SUPABASE_URL}/rest/v1/licenses?limit=1`, { headers });
    const lic = await resLic.json();
    console.log("License sample:", lic[0] ? Object.keys(lic[0]) : "Empty");

    const resSub = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?limit=1`, { headers });
    const sub = await resSub.json();
    console.log("Subscription sample:", sub[0] ? Object.keys(sub[0]) : "Empty");
}
run().catch(console.error);
