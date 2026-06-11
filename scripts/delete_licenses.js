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

    const companies = ['test_srinjoy', 'client', 'test_WP'];

    for (const companyId of companies) {
        console.log(`Processing company: ${companyId}`);
        const resSite = await fetch(`${SUPABASE_URL}/rest/v1/sites?select=*&company_id=eq.${companyId}&limit=1`, { headers });
        const site = (await resSite.json())[0];

        if (site && site.license_id) {
            console.log(`  Found license_id: ${site.license_id}. Deleting...`);
            
            // Delete license
            const delLicRes = await fetch(`${SUPABASE_URL}/rest/v1/licenses?id=eq.${site.license_id}`, {
                method: 'DELETE',
                headers
            });
            if (delLicRes.ok) {
                console.log(`  Successfully deleted license for ${companyId}`);
            } else {
                console.error(`  Failed to delete license: ${await delLicRes.text()}`);
            }

            // Also detach it from the site to avoid foreign key issues or dangling references
            const updateSiteRes = await fetch(`${SUPABASE_URL}/rest/v1/sites?id=eq.${site.id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ license_id: null })
            });
            if (updateSiteRes.ok) {
                console.log(`  Detached license_id from site ${site.id}`);
            }
        } else {
            console.log(`  No license found for company ${companyId}`);
        }
    }
}

run().catch(console.error);
