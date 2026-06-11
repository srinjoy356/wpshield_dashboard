import requests
import json
import sys
import os
import time

# --- Configuration ---
NEXT_URL = "http://localhost:3000"
SUPABASE_URL = "https://awyihjjjlnqbhccmfsoa.supabase.co"
SUPABASE_KEY = "sb_secret_v4-mi3YTAVzny1XGH3jnUw_hYj2tUpW" # Service role key

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

print("=== Starting Track 1 Automated Tests ===")

# Check if Next.js is running
try:
    requests.get(NEXT_URL, timeout=2)
except requests.exceptions.ConnectionError:
    print(f"❌ ERROR: Next.js server is not running on {NEXT_URL}. Please run 'npm run dev' before testing.")
    sys.exit(1)

# 1. Fetch a valid site token for testing
print("\n[1] Fetching a valid site_token from Supabase...")
res = requests.get(f"{SUPABASE_URL}/rest/v1/sites?select=site_token,site_url,company_id&limit=1", headers=headers)
if res.status_code != 200 or not res.json():
    print("❌ Failed to fetch a site_token from Supabase or table is empty.")
    print("Response:", res.text)
    sys.exit(1)

site_data = res.json()[0]
site_token = site_data["site_token"]
site_url = site_data["site_url"]
company_id = site_data["company_id"]
print(f"✅ Found valid site_token for: {site_url}")

# 2. Test Zod Payload Validation (Valid Payload)
print("\n[2] Testing Zod Validation - Valid Payload")
valid_payload = {
    "event_type": "attack",
    "site_url": site_url,
    "severity": "medium",
    "action": "Failed login attempt",
    "details": {"ip": "1.2.3.4", "user": "admin"}
}
res_valid = requests.post(
    f"{NEXT_URL}/api/ingest/events",
    headers={"Authorization": f"Bearer {site_token}", "Content-Type": "application/json"},
    json=valid_payload
)

if res_valid.status_code == 200:
    print("✅ Valid payload accepted (200 OK). Zod parsing passed.")
else:
    print(f"❌ Failed! Expected 200, got {res_valid.status_code}.")
    print("Response:", res_valid.text)

# 3. Test Zod Payload Validation (Malformed Payload)
print("\n[3] Testing Zod Validation - Malformed Payload (Numbers instead of Strings)")
invalid_payload = {
    "event_type": 123, # Should be a string
    "site_url": site_url,
    "severity": "low",
    "action": 456
}
res_invalid = requests.post(
    f"{NEXT_URL}/api/ingest/events",
    headers={"Authorization": f"Bearer {site_token}", "Content-Type": "application/json"},
    json=invalid_payload
)

if res_invalid.status_code == 400:
    print("✅ Malformed payload successfully rejected (400 Bad Request).")
    print("   Zod Error:", res_invalid.json().get("error", "Unknown"))
else:
    print(f"❌ Failed! Expected 400, got {res_invalid.status_code}. Zod validation might be missing.")

# 4. Test Webhook DB Encryption
print("\n[4] Testing Webhook Encryption")
test_webhook = "https://hooks.slack.com/services/T123/B456/TEST"
# Trigger the notify save API
res_save = requests.post(
    f"{NEXT_URL}/api/notify",
    headers={"Content-Type": "application/json"},
    json={
        "company_id": company_id,
        "notify_slack_webhook": test_webhook,
        "notify_severity_threshold": "low"
    }
)
if res_save.status_code != 200:
    print("❌ Failed to save webhook via API.")
    print(res_save.text)
else:
    # Now fetch it directly from DB to verify it's encrypted
    res_db = requests.get(f"{SUPABASE_URL}/rest/v1/companies?select=notify_slack_webhook&company_id=eq.{company_id}", headers=headers)
    db_webhook = res_db.json()[0]["notify_slack_webhook"]
    
    if db_webhook == test_webhook:
        print("❌ Failed! The webhook is stored in plain text in the database.")
    elif ":" in db_webhook and len(db_webhook) > 40:
        print(f"✅ Webhook is securely encrypted at rest in DB. (Encrypted value: {db_webhook[:10]}...)")
    else:
        print("❓ Unclear if webhook is encrypted. DB Value:", db_webhook)

print("\n=== All Automated Tests Completed ===")
