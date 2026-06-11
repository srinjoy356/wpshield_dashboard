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

    console.log("Checking subscriptions...");
    const resSubs = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=id,status`, { headers });
    const subs = await resSubs.json();
    console.log("Found Subscriptions:", subs);

    for (const sub of subs) {
        // First delete licenses referencing this subscription
        const r1 = await fetch(`${SUPABASE_URL}/rest/v1/licenses?subscription_id=eq.${sub.id}`, { method: 'DELETE', headers });
        if (!r1.ok) console.log(`Failed to delete licenses for sub ${sub.id}:`, await r1.text());

        // Then delete the subscription
        const r2 = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers });
        if (!r2.ok) console.log(`Failed to delete sub ${sub.id}:`, await r2.text());
        else console.log(`Deleted sub ${sub.id} successfully.`);
    }

    console.log("Checking plans...");
    const resPlans = await fetch(`${SUPABASE_URL}/rest/v1/plans?select=id,name`, { headers });
    const plans = await resPlans.json();
    console.log("Found Plans:", plans);

    for (const plan of plans) {
        if (plan.id !== 'test-plan' && plan.name !== 'Test Plan' && plan.id !== 'trial') {
            const r3 = await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${plan.id}`, { method: 'DELETE', headers });
            if (!r3.ok) console.log(`Failed to delete plan ${plan.name}:`, await r3.text());
            else console.log(`Deleted plan ${plan.name} successfully.`);
        }
    }
}

run().catch(console.error);
