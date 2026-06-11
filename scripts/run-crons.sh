#!/bin/bash
BASE_URL="https://your-app.onrender.com"
SECRET="$CRON_SECRET"

curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/threat-intel"
curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/vuln-check"
curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/uptime-check"
curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/safe-browsing"
curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/hardening-audit"
curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/reconciliation"
curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/scheduled-reports"
curl -s -H "x-cron-secret: $SECRET" "$BASE_URL/api/cron/send-reports"