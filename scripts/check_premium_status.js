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

    const companyId = 'test_WP';

    console.log(`Checking premium status for company: ${companyId}`);

    const resCompany = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=*&company_id=eq.${companyId}&limit=1`, { headers });
    const company = (await resCompany.json())[0];
    console.log('Company:', company ? { company_id: company.company_id, blocking_enabled: company.blocking_enabled } : null);

    const resSite = await fetch(`${SUPABASE_URL}/rest/v1/sites?select=*&company_id=eq.${companyId}&limit=1`, { headers });
    const site = (await resSite.json())[0];
    console.log('Site:', site ? { id: site.id, license_id: site.license_id } : null);

    if (site && site.license_id) {
        const resLicense = await fetch(`${SUPABASE_URL}/rest/v1/licenses?select=*&id=eq.${site.license_id}&limit=1`, { headers });
        const license = (await resLicense.json())[0];
        console.log('License:', license ? { id: license.id, license_key: license.license_key, subscription_id: license.subscription_id } : null);

        if (license && license.subscription_id) {
            const resSub = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=*&id=eq.${license.subscription_id}&limit=1`, { headers });
            const sub = (await resSub.json())[0];
            console.log('Subscription:', sub ? { id: sub.id, status: sub.status } : null);
        } else {
            console.log('No subscription_id found on this license.');
        }
    }
}

run().catch(console.error);
