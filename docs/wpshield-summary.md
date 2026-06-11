# WPShield — Executive Summary
## By Cybernara | May 2026

---

## What is it?
WPShield is an enterprise-grade security monitoring platform designed specifically for WordPress. It provides real-time visibility into security threats and site activities across multiple websites, consolidating them into a single, professional dashboard for administrators and clients.

---

## The Problem it Solves
Without WPShield, managing security for multiple WordPress sites is reactive and fragmented:
- **Invisible Threats**: Attacks and file changes often go unnoticed for weeks.
- **Fragmented Logs**: Security data is trapped inside individual site databases.
- **Manual Auditing**: Teams must manually log into every site to check for updates or suspicious logins.
- **No History**: Detailed security telemetry is rarely preserved for long-term audit trails.

---

## How it Works
1.  **Monitor**: A lightweight plugin captures all security events on the WordPress site.
2.  **Sync**: Data is automatically sent to a secure central database every 5 minutes.
3.  **Analyze**: System triggers automatically identify critical threats (e.g., file changes or brute force).
4.  **Alert**: High-priority security notifications are generated instantly.
5.  **Manage**: Admins and clients view, acknowledge, and resolve events from the dashboard.

---

## Who Uses it
- **Administrators**: The Cybernara team uses it to oversee all client sites and manage the platform.
- **Clients**: Individual website owners use it to monitor their own site's security and history.

---

## Key Features (Top 10)
- **Auto-Discovery**: New sites are detected automatically upon plugin installation.
- **Multi-Tenant Isolation**: Complete data separation between different clients.
- **Attack Detection**: Real-time logging of SQLi, XSS, and RCE attempts.
- **File Integrity**: Immediate flagging of any unauthorized PHP file modifications.
- **Inventory Tracking**: Daily snapshots of all active plugins and themes.
- **Audit Trail**: Every administrative action is logged and searchable.
- **Intelligent Alerts**: Automated notification system for critical security events.
- **Client Management**: Full control over user accounts (Onboard, Suspend, Delete).
- **Interactive Analytics**: Visual charts for security trends and severity distributions.
- **Privacy Controls**: Granular "data-sharing" checklist for client-side privacy.

---

## Current Status
- **Live**: WPShield Collector active on `cybernara.com`.
- **Dashboard**: Core engine and UI fully operational on local environment.
- **Onboarded**: 1 primary client (`cybernara`) currently being monitored.
- **Volume**: 74+ events captured and 48+ alerts generated to date.
- **Infrastructure**: Powered by Next.js 14 and Supabase.

---

## What's Next
- **Automated Notifications**: Real-time email alerts for high-priority security threats.
- **Production Deployment**: Transitioning the dashboard from local to a dedicated VPS.
- **Advanced Exporting**: PDF and CSV reporting for client security reviews.
