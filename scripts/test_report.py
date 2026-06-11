import os
import sys
import json

# Ensure scripts directory is in the import path
scripts_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(scripts_dir)

from generate_report import generate_pdf

test_data = {
  "company": {
    "display_name": "cybernara",
    "site_url": "https://cybernara.com",
    "last_seen_at": "2026-05-30T06:00:00+00:00"
  },
  "period": "Last 30 Days",
  "generatedAt": "2026-05-30T06:00:00+00:00",
  "maturity": {
    "score": 60,
    "label": "Needs Attention"
  },
  "stats": {
    "totalAttacks": 42,
    "totalLogins": 23,
    "totalFileChanges": 698,
    "openAlerts": 655
  },
  "vulnerablePlugins": [
    {
      "plugin_name": "Advanced Custom Fields PRO",
      "plugin_version": "6.2.1.1",
      "cve_id": "2024-49593",
      "severity": "medium",
      "fixed_in": "6.3.9"
    }
  ],
  "topAttackingIps": [
    {
      "ip": "34.131.209.193",
      "count": 40,
      "pattern_type": "sensitive_404"
    },
    {
      "ip": "9.9.9.9",
      "count": 2,
      "pattern_type": "sqli"
    }
  ],
  "recentFileChanges": [
    {
      "path": "wp-content/plugins/sg-ai-studio/sg-ai-studio.php",
      "event": "file_modified",
      "occurred_at": "2026-05-29T14:26:14+00:00"
    },
    {
      "path": "wp-content/plugins/sg-ai-studio/core/Rest/Menus.php",
      "event": "file_added",
      "occurred_at": "2026-05-29T14:26:14+00:00"
    }
  ],
  "failedChecks": [
    {
      "check_name": "No Vulnerable Plugins",
      "priority": "high",
      "recommendation": "Update all flagged plugins to their fixed versions immediately."
    },
    {
      "check_name": "No High Open Alerts",
      "priority": "medium",
      "recommendation": "Review and acknowledge or resolve high severity alerts."
    },
    {
      "check_name": "No Recent File Modification Alerts",
      "priority": "medium",
      "recommendation": "Review all file change alerts and verify they were authorized."
    }
  ]
}

def main():
    # 4. Create the /scripts/report/ folder if it doesn't exist
    report_dir = os.path.join(scripts_dir, 'report')
    os.makedirs(report_dir, exist_ok=True)
    
    # 2. Call generate_pdf()
    pdf_bytes = generate_pdf(test_data)
    
    # 3. Saves output to /scripts/report/test-report.pdf
    pdf_path = os.path.join(report_dir, 'test-report.pdf')
    with open(pdf_path, 'wb') as f:
        f.write(pdf_bytes)
        
    # 5. Prints success message with file path
    print(f"Success! PDF report generated and saved at: {pdf_path}")

if __name__ == '__main__':
    main()
