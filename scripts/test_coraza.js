require('dotenv').config({ path: '.env.local' });
const { evaluateShadowPayload } = require('./lib/security/waf-engine');

async function testWafLocal() {
    console.log("Testing WAF evaluation directly...");
    
    // Malicious base64-decoded payload
    const body = "username=admin&password=1' OR '1'='1' UNION SELECT username, password FROM wp_users";
    
    await evaluateShadowPayload(
        "test_WP",
        "203.0.113.44",
        "POST",
        "/wp-login.php",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) sqlmap/1.4",
        body
    );
    
    console.log("Evaluation complete. Check your Next.js or supabase logs.");
}

testWafLocal().catch(console.error);
