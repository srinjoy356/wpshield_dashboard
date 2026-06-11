# WPShield — Product Documentation
## By Cybernara
### Version 1.0 | May 2026

---

## What is WPShield?

WPShield is a comprehensive security monitoring platform designed specifically for WordPress ecosystems. It serves as a "silent guardian" for your website, continuously capturing and analyzing security telemetry to provide real-time visibility into your site's health. 

By monitoring attacks, authentication attempts, file integrity, and site configuration, WPShield ensures that you are always the first to know when something suspicious occurs on your site.

---

## Who is it for?

### 1. The Administrator (Cybernara Team)
Admins use WPShield to manage a portfolio of client websites from a single interface. They can discover new sites, onboard clients, manage user accounts, and monitor security alerts across the entire network.

### 2. The Client (Website Owner)
Clients receive a private, high-fidelity dashboard dedicated to their own site. They can review attack logs, track logins, monitor file changes, and manage actionable security alerts to ensure their digital presence remains secure.

---

## How does it work?

The WPShield ecosystem consists of a seamless flow from the edge site to the central dashboard:

1.  **WordPress Site**: The WPShield plugin is installed on the client's site.
2.  **Event Capture**: The plugin instantly logs security events (attacks, logins, file changes) into a local queue.
3.  **Data Transmission**: Every 5 minutes, the plugin securely flushes these events to the Supabase database.
4.  **Intelligent Alerts**: The system automatically generates alerts for serious events based on predefined security rules.
5.  **Dashboard Visualization**: Admins and clients view the processed data in a clean, intuitive interface.

---

## The WordPress Plugin

The WPShield Collector is a lightweight, read-only plugin designed for maximum efficiency and minimum impact.

- **Non-Intrusive**: It never modifies site content or blocks legitimate traffic.
- **Monitoring Scope**:
    - **Attack Detection**: SQL Injection, XSS, RCE, and more.
    - **Login Activity**: All successes, failures, and role changes.
    - **File Integrity**: Monitoring of PHP files for unauthorized changes.
    - **Inventory**: Daily snapshots of plugins, themes, and versions.
- **Privacy First**: Clients have a data-sharing checklist to opt-in or out of specific telemetry categories (e.g., user emails or request headers).
- **Configuration**: Simply enter your Company ID and Supabase credentials to begin monitoring.

---

## The Dashboard

### Admin Dashboard
Designed for high-level oversight and management:
- **Overview**: A multi-tenant dashboard with global stats, activity charts, and high-priority event feeds.
- **Clients**: Manage the full lifecycle of client accounts, from auto-discovery (Pending Sites) to suspension or deletion.
- **Alerts**: A centralized summary of alerts across all companies, allowing for efficient triaging.
- **Activity Logs**: A complete audit trail of all administrative actions for compliance and security.

### Client Dashboard
A dedicated view for individual site security:
- **Overview**: Real-time health metrics and recent activity for the specific site.
- **Attacks**: A detailed log of blocked malicious patterns and suspicious IPs.
- **Logins**: Tracking of every authentication event, including administrator role changes.
- **File Integrity**: A clear record of all PHP file modifications or additions.
- **Inventory**: A snapshot of current plugins, themes, and WordPress core status.
- **Alerts**: A dedicated workspace to acknowledge and resolve active security notifications.

---

## Alert System

WPShield doesn't just show data; it generates intelligence. Alerts are automatically created for critical events:

- **File Modifications**: Any change to PHP files triggers a HIGH severity alert.
- **High-Severity Attacks**: SQLi, XSS, or RCE attempts are flagged immediately.
- **Privilege Escalation**: Granting an administrator role triggers a CRITICAL alert.
- **Brute Force Detection**: Multiple failed logins from a single IP within a short window fire a HIGH alert.

**Alert Lifecycle**:
- **Open**: New, unaddressed security concern.
- **Acknowledged**: Under investigation by the team.
- **Resolved**: The threat has been addressed or confirmed as safe.

---

## Multi-tenant Architecture

WPShield is built from the ground up for data isolation and scale.
- **Total Isolation**: Using Supabase Row Level Security (RLS), clients can only ever see data associated with their unique Company ID.
- **Auto-Discovery**: When a new site installs the plugin, it appears in the Admin's "Pending" list automatically, making onboarding frictionless.
- **Scalability**: The platform is designed to handle hundreds of client sites sharing a single, secure database infrastructure.

---

## Security & Privacy

We take the security of your security platform seriously:
- **Read-Only Plugin**: The collector has no capability to modify your WordPress database or files.
- **Encrypted Transmission**: All data is sent over HTTPS with service-role authentication.
- **Audit Logging**: Every action taken by a Cybernara admin is logged and cannot be deleted, ensuring full accountability.
- **Granular Permissions**: Admins have restricted access based on their role, and clients are locked to their own company silo.

---

## Feature List

### Plugin Features
- [x] Attack detection (SQLi, XSS, LFI, RCE, etc.)
- [x] Security scanner detection (WPScan, Nikto, etc.)
- [x] Sensitive file probe detection
- [x] Login & Logout tracking
- [x] Role change and user creation detection
- [x] PHP file integrity monitoring
- [x] Daily plugin/theme inventory snapshots
- [x] Configurable 5-minute flush interval
- [x] Data-sharing privacy checklist
- [x] Robust local retry logic (10 attempts)

### Dashboard Features
- [x] Real-time security overview charts
- [x] Auto-discovery onboarding flow
- [x] Full client account management (Suspend, Reset, Delete)
- [x] Multi-client alert summary for admins
- [x] Interactive event timelines
- [x] Relative time rendering for better readability
- [x] Sidebar preference persistence

---

## Roadmap

The future of WPShield includes:
- **Instant Notifications**: Email and Webhook alerts for critical events.
- **Real-Time Feed**: Live dashboard updates using Supabase Realtime.
- **Export Tools**: CSV and PDF security report generation.
- **Dark Mode**: High-contrast theme for security operations centers.
- **Advanced Filtering**: Global search and deep-link filtering across all event tables.
