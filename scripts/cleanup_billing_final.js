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

    console.log("1. Detaching all licenses from sites...");
    const r0 = await fetch(`${SUPABASE_URL}/rest/v1/sites?id=not.is.null`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ license_id: null })
    });
    if (!r0.ok) console.log("Failed to detach licenses:", await r0.text());
    else console.log("Successfully detached licenses from sites.");

    console.log("2. Deleting all licenses...");
    const r1 = await fetch(`${SUPABASE_URL}/rest/v1/licenses?id=not.is.null`, {
        method: 'DELETE',
        headers
    });
    if (!r1.ok) console.log("Failed to delete licenses:", await r1.text());
    else console.log("Successfully deleted all licenses.");

    console.log("3. Deleting all subscriptions...");
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=not.is.null`, {
        method: 'DELETE',
        headers
    });
    if (!r2.ok) console.log("Failed to delete subscriptions:", await r2.text());
    else console.log("Successfully deleted all subscriptions.");

    console.log("4. Cleaning up plans...");
    const resPlans = await fetch(`${SUPABASE_URL}/rest/v1/plans?select=id,name`, { headers });
    const plans = await resPlans.json();

    for (const plan of plans) {
        if (plan.id !== 'test-plan' && plan.name !== 'Test Plan' && plan.id !== 'trial') {
            const r3 = await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${plan.id}`, { method: 'DELETE', headers });
            if (!r3.ok) console.log(`Failed to delete plan ${plan.name}:`, await r3.text());
            else console.log(`Deleted plan ${plan.name} successfully.`);
        }
    }

    console.log("5. Ensure Test Plan is $1...");
    await fetch(`${SUPABASE_URL}/rest/v1/plans?name=eq.Test Plan`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ price: 1 })
    });
    console.log("Done!");
}

run().catch(console.error);
