const http = require('http');

const NEXT_URL = "http://localhost:3000";
const SUPABASE_URL = "https://awyihjjjlnqbhccmfsoa.supabase.co";
const SUPABASE_KEY = "sb_secret_v4-mi3YTAVzny1XGH3jnUw_hYj2tUpW"; // Service role key

const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json"
};

async function runTests() {
    console.log("=== Starting Track 1 Automated Tests ===");

    try {
        // Check if Next.js is running
        try {
            await fetch(NEXT_URL);
        } catch (err) {
            console.error(`❌ ERROR: Next.js server is not running on ${NEXT_URL}. Please run 'npm run dev' before testing.`);
            process.exit(1);
        }

        console.log("\n[1] Fetching a site and creating a test token...");
        const resSites = await fetch(`${SUPABASE_URL}/rest/v1/sites?select=*&limit=1`, { headers });
        const sites = await resSites.json();
        
        if (!Array.isArray(sites) || sites.length === 0) {
            console.error("❌ No sites found in Supabase table or invalid response.");
            console.error(sites);
            process.exit(1);
        }
        const { id: site_id, url: site_url, company_id } = sites[0];

        // Generate test token and hash it
        const crypto = require('crypto');
        const rawToken = "test_token_" + Date.now();
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Insert into site_tokens
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/site_tokens`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify({
                site_id: site_id,
                token_hash: tokenHash,
                token_prefix: rawToken.substring(0, 8),
                created_at: new Date().toISOString()
            })
        });

        if (!insertRes.ok) {
            console.error("❌ Failed to insert test token.", await insertRes.text());
            process.exit(1);
        }

        const site_token = rawToken;
        console.log(`✅ Created test token for site: ${site_url}`);

        console.log("\n[2] Testing Zod Validation - Valid Payload");
        const validPayload = {
            event_type: "attack",
            site_url: site_url,
            severity: "medium",
            action: "Failed login attempt",
            details: { ip: "1.2.3.4", user: "admin" }
        };
        const resValid = await fetch(`${NEXT_URL}/api/ingest/events`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${site_token}`, "Content-Type": "application/json" },
            body: JSON.stringify(validPayload)
        });
        if (resValid.ok) {
            console.log("✅ Valid payload accepted (200 OK). Zod parsing passed.");
        } else {
            console.error(`❌ Failed! Expected 200, got ${resValid.status}.`);
            console.error("Response:", await resValid.text());
        }

        console.log("\n[3] Testing Zod Validation - Malformed Payload (Numbers instead of Strings)");
        const invalidPayload = {
            event_type: 123,
            site_url: site_url,
            severity: "low",
            action: 456
        };
        const resInvalid = await fetch(`${NEXT_URL}/api/ingest/events`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${site_token}`, "Content-Type": "application/json" },
            body: JSON.stringify(invalidPayload)
        });
        if (resInvalid.status === 400) {
            const data = await resInvalid.json();
            console.log("✅ Malformed payload successfully rejected (400 Bad Request).");
            console.log("   Zod Error:", data.error || "Unknown");
        } else {
            console.error(`❌ Failed! Expected 400, got ${resInvalid.status}. Zod validation might be missing.`);
        }

        console.log("\n[4] Testing Webhook Encryption");
        const testWebhook = "https://hooks.slack.com/services/T123/B456/TEST";
        const resSave = await fetch(`${NEXT_URL}/api/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                company_id: company_id,
                notify_slack_webhook: testWebhook,
                notify_severity_threshold: "low"
            })
        });
        if (!resSave.ok) {
            if (resSave.status === 401 || resSave.status === 403) {
                console.log(`✅ Webhook update correctly blocked (${resSave.status}). Security guard 'requireCustomerAccess' is working!`);
                console.log("   (Manual testing required to test encryption via UI session).");
            } else {
                console.error("❌ Failed to save webhook via API.");
                console.error(await resSave.text());
            }
        } else {
            const resDb = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=notify_slack_webhook&company_id=eq.${company_id}`, { headers });
            const companies = await resDb.json();
            const dbWebhook = companies[0].notify_slack_webhook;

            if (dbWebhook === testWebhook) {
                console.error("❌ Failed! The webhook is stored in plain text in the database.");
            } else if (dbWebhook.includes(":") && dbWebhook.length > 40) {
                console.log(`✅ Webhook is securely encrypted at rest in DB. (Encrypted value: ${dbWebhook.substring(0, 10)}...)`);
            } else {
                console.log("❓ Unclear if webhook is encrypted. DB Value:", dbWebhook);
            }
        }

        console.log("\n=== All Automated Tests Completed ===");
    } catch (e) {
        console.error("Error running tests:", e);
    }
}

runTests();
