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

    console.log("Fetching all subscriptions to delete...");
    const resSubs = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=id`, { headers });
    const subs = await resSubs.json();

    if (subs && subs.length > 0) {
        for (const sub of subs) {
            console.log(`Deleting subscription: ${sub.id}`);
            // Also delete any licenses associated with this subscription
            await fetch(`${SUPABASE_URL}/rest/v1/licenses?subscription_id=eq.${sub.id}`, { method: 'DELETE', headers });
            await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${sub.id}`, { method: 'DELETE', headers });
        }
    } else {
        console.log("No subscriptions found.");
    }

    console.log("Fetching plans to clean up...");
    const resPlans = await fetch(`${SUPABASE_URL}/rest/v1/plans?select=*`, { headers });
    let plans = await resPlans.json();

    if (plans && plans.length > 0) {
        let testPlanId = null;
        
        // Find if 'Test Plan' already exists
        const existingTestPlan = plans.find(p => p.name.toLowerCase().includes('test'));
        if (existingTestPlan) {
            testPlanId = existingTestPlan.id;
        }

        // If no test plan exists, keep the first one and rename it
        if (!testPlanId && plans.length > 0) {
            testPlanId = plans[0].id;
            console.log(`Renaming plan ${testPlanId} to Test Plan`);
            await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${testPlanId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ name: 'Test Plan', price: 1 })
            });
        }

        // Delete all other plans
        for (const plan of plans) {
            if (plan.id !== testPlanId && plan.id !== 'trial') {
                console.log(`Deleting plan: ${plan.name} (${plan.id})`);
                await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${plan.id}`, { method: 'DELETE', headers });
            }
        }
        
        // Ensure test plan has a price of 1
        console.log(`Updating Test Plan price to $1`);
        await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${testPlanId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ price: 1 })
        });
    }

    console.log("Cleanup complete!");
}

run().catch(console.error);
