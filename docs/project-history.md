# WPShield Dashboard — Project Build History
## Cybernara Internal Document
### Last Updated: May 10, 2026

---

## 🎯 Project Goal
The Cybernara WPShield project was conceived as a robust, multi-tenant security monitoring ecosystem for WordPress websites. The goal was to provide real-time visibility into security threats, login activities, file changes, and site inventory across multiple client installations through a centralized, high-fidelity dashboard.

**Key Components:**
- **WordPress Plugin**: A lightweight "collector" installed on client sites.
- **Supabase Backend**: A secure, scalable database and authentication layer.
- **Web Dashboard**: A modern Next.js application for administrators and clients.

---

## 📅 Build Timeline

### Phase 0 — The WordPress Plugin (WPShield Collector)
Development began with the WordPress plugin, designed as a read-only telemetry collector to ensure no interference with site operations.
- **Functionality**: Captures attacks (SQLi, XSS, etc.), login events, file integrity changes, and daily inventory snapshots.
- **Architecture**: Implements a local queuing system to prevent performance bottlenecks. Events are flushed to Supabase every 5 minutes in batches of up to 50.
- **Data Model**: Writes directly to 4 core tables: `wpshield_events_attack`, `wpshield_events_login`, `wpshield_events_file`, and `wpshield_inventory_snapshots`.
- **Security**: Transitioned from a custom HMAC signing method to the Supabase REST API using a `service-role` key for secure, authenticated data transmission.

### Phase 1 — Supabase Foundation
The backend architecture was established using Supabase, focusing on multi-tenancy and automated site discovery.
- **Schema**: Created 5 primary tables: `companies`, `pending_companies`, `user_profiles`, `alerts`, and `activity_logs`.
- **Auto-Detection**: Implemented a Postgres trigger system. When the plugin sends data from a new `company_id`, the system automatically creates an entry in `pending_companies`, allowing admins to "discover" new clients.
- **Security**: Configured Row Level Security (RLS) policies and helper functions (`is_admin()`, `get_user_company_id()`) to ensure total data isolation between tenants.

### Phase 2A — Authentication
Integrated robust authentication and role-based access control.
- **Integration**: Used `@supabase/ssr` for seamless Next.js authentication.
- **Routing**: Implemented role-based redirection (Admins to `/admin`, Clients to `/app`) and middleware protection for all routes.
- **Super Admin**: Manually provisioned the first super administrator (`admin@wpshield.com`) to manage the platform.

### Phase 2B — Real Data Wiring
Transitioned the dashboard from static mocks to a dynamic, data-driven application.
- **Query Layer**: Built a structured query library in `/lib/queries/` using Server Components for efficient data fetching.
- **UX**: Implemented loading skeletons and empty states to provide a premium feel even during data retrieval.
- **Milestone**: Successfully detected the first live site (`cybernara`) in the pending list with 64 initial security events.

### Phase 2C — Client Onboarding Flow
Developed the "Onboard" bridge to move sites from discovery to full management.
- **Workflow**: Admins select a pending site, fill in client details, and trigger an atomic server action.
- **Automation**: The `onboardClientAction` creates a Supabase Auth user, establishes the company record, links the user profile, and removes the site from the pending list—all in one transaction.
- **First Client**: `prem@cybernara.com` was onboarded as the first official client for the `cybernara` site.

### Phase 3 — UI Build (Antigravity)
The visual identity and interface were crafted for a professional, "white-themed" security experience.
- **Tech Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, and shadcn/ui.
- **Design System**: A Notion-inspired aesthetic using warm neutrals, deep blacks for primary elements, and a teal accent (`#0D9488`) for the brand.
- **Pages**: 16 dedicated pages were built across Admin and Client layouts, featuring custom charts (Recharts) and icons (Lucide).

### Phase 4 — Admin Features
Expanded administrative capabilities for comprehensive client management.
- **Client Detail**: Built a deep-dive view at `/admin/clients/[companyId]` featuring 6 specialized tabs for all security metrics.
- **Control Panel**: Implemented account actions including Edit, Reset Password, Suspend/Unsuspend, and Delete.
- **Audit Trail**: Every administrative action is automatically logged to the `activity_logs` table, providing a full security history for the platform.

### Phase 5 — Alert Generation
Implemented an automated "intelligence" layer to flag critical events.
- **Logic**: 3 Postgres triggers monitor incoming events and generate alerts based on predefined rules (e.g., PHP file modifications, high-severity attacks, or admin role changes).
- **Workflow**: Developed an Acknowledge/Resolve lifecycle for alerts, ensuring no threat goes unaddressed.
- **Redesign**: Enhanced the admin alerts view into a company-based summary table, allowing for efficient multi-client monitoring.

---

## 🐞 Bugs Encountered & Fixed

1. **Plugin Fatal Error on Activation**
   - *Cause*: Attempting to schedule cron tasks before custom intervals were registered.
   - *Fix*: Moved scheduling logic from the activation hook to the `ensure_scheduled` check on plugin load.

2. **Supabase 403 on Plugin Ping**
   - *Cause*: The `service_role` lacked explicit permissions to insert into the public schema tables.
   - *Fix*: Executed `GRANT ALL` on the 4 event tables to the `service_role` user.

3. **Login "Account is not configured" Error**
   - *Cause*: RLS recursion bug where `is_admin()` queried `user_profiles`, which was protected by a policy calling `is_admin()`.
   - *Fix*: Converted helper functions to `SECURITY DEFINER` and adjusted policies to avoid circular dependencies.

4. **NaN KB in File Integrity Table**
   - *Cause*: Size column was null for certain file events, leading to rendering errors.
   - *Fix*: Added null guards and used `COALESCE` in the SQL query and UI rendering.

5. **Inventory Snapshot Crash**
   - *Cause*: JSONB payloads were being accessed as objects before parsing.
   - *Fix*: Implemented robust JSON parsing and error handling in the inventory data builder.

6. **Hydration Mismatch Error**
   - *Cause*: Server and client clocks differed by milliseconds during relative time rendering.
   - *Fix*: Created the `TimeCell` component to defer relative time rendering until after the component mounts.

7. **Slow Logout Experience**
   - *Cause*: The UI waited for the Supabase `signOut()` network request to complete before redirecting.
   - *Fix*: Updated logic to perform an immediate client-side redirect while `signOut()` runs in the background.

8. **Sidebar State Reset**
   - *Cause*: State was held only in memory, resetting on every page navigation.
   - *Fix*: Implemented `localStorage` persistence with a `useEffect` hook to remember user preferences.

---

## 🗄️ Database Schema Summary
- **wpshield_events_attack**: Raw logs of detected malicious patterns (SQLi, XSS, etc.).
- **wpshield_events_login**: Tracking for all login, logout, and authentication attempts.
- **wpshield_events_file**: Audit logs of all PHP file modifications, additions, and deletions.
- **wpshield_inventory_snapshots**: Daily records of plugins, themes, and version info.
- **companies**: Registry of onboarded clients and their statuses.
- **pending_companies**: Auto-discovery list for sites sending telemetry.
- **user_profiles**: Mapping of dashboard users to their roles and companies.
- **alerts**: Intelligent security notifications generated from raw events.
- **activity_logs**: The master audit trail for all dashboard administrative actions.

---

## 🔑 Credentials & Config Reference
*(Internal use only)*

**WordPress Plugin Settings:**
- **Company ID**: cybernara (primary testing)
- **Flush Interval**: 5 Minutes
- **Batch Size**: 50 Events

**Dashboard Info:**
- **Admin Login**: admin@wpshield.com
- **First Client**: prem@cybernara.com
- **Project Location**: ap-south-1 (Mumbai)
