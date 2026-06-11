# Cybernara WPShield Dashboard

Multi-tenant WordPress security monitoring dashboard built with Next.js 14, Tailwind CSS, shadcn/ui, and Recharts.

## Phase 2A — Auth Setup

This phase implements real Supabase Authentication and Role-Based Access Control (RBAC).

### 1. Create the first Super Admin
To access the admin dashboard, follow these steps:

1.  **Create Auth User**: Go to your Supabase Dashboard → Authentication → Users → "Add user" → "Create new user".
2.  **Details**: Enter `admin@wpshield.com` and a password of your choice. Ensure "Auto Confirm User" is checked.
3.  **Copy UUID**: After creation, copy the **User UID** from the list.
4.  **Create Profile**: Go to the SQL Editor and run the following (replace `<PASTE_UUID_HERE>` with the copied ID):
    ```sql
    INSERT INTO public.user_profiles (id, role, company_id, display_name)
    VALUES ('<PASTE_UUID_HERE>', 'admin', NULL, 'Super Admin');
    ```
5.  **Log In**: Go to `/login` and sign in with your credentials. You will be redirected to `/admin`.

### 2. How it works
- **Authentication**: Uses `@supabase/ssr` for secure session management.
- **Middleware**: A `middleware.ts` file enforces role-based protection:
    - `/admin/*` requires `role = 'admin'`.
    - `/app/*` requires `role = 'client'`.
    - Unauthenticated users are redirected to `/login`.
- **RBAC**: User roles are stored in the `user_profiles` table, linked to `auth.users`.

### 3. Verification
- [ ] Log in with `admin@wpshield.com` → redirects to `/admin`.
- [ ] Try to access `/app` as an admin → redirected to `/login?error=unauthorized`.
- [ ] Log out → redirected to `/login` with a success toast.
- [ ] Sidebar shows real user initials and "Super Admin" name.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Folder Structure

```
├── app/
│   ├── (auth)/login/       # Login page with dev toggle
│   ├── admin/              # Admin routes (7 pages)
│   ├── app/                # Client routes (7 pages)
│   └── layout.tsx          # Root layout with Inter font
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── dashboard/          # Reusable dashboard components
│   ├── charts/             # Chart components
│   └── layouts/            # AdminLayout, ClientLayout
├── lib/
│   ├── supabase/           # Supabase client helpers (not wired yet)
│   ├── mock-data.ts        # All mock entities (typed)
│   └── utils.ts            # cn helper, date formatters
├── types/
│   └── index.ts            # Shared TypeScript types
├── supabase/
│   └── migrations/
│       └── 001_foundation.sql  # Phase 1 database migration
├── public/
│   └── logos/              # Brand logos (3 files)
└── tailwind.config.ts      # Brand colors as CSS variables
```

## Applying the SQL Migration

1. Open your Supabase project's **SQL Editor**
2. Paste the contents of `supabase/migrations/001_foundation.sql`
3. Run the query

### Verification Checklist

After applying the migration, verify:

- [ ] `SELECT * FROM companies;` → returns 0 rows, no errors
- [ ] `SELECT * FROM pending_companies;` → returns 0 rows, no errors
- [ ] `SELECT * FROM user_profiles;` → returns 0 rows, no errors
- [ ] `SELECT * FROM alerts;` → returns 0 rows, no errors
- [ ] `SELECT * FROM activity_logs;` → returns 0 rows, no errors
- [ ] `SELECT is_admin();` → returns `false` when called by anon
- [ ] `SELECT get_user_company_id();` → returns `null` when called by anon
- [ ] Insert a test event with a new `company_id` into `wpshield_events_attack` → verify a new row appears in `pending_companies`

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Charts:** Recharts
- **Icons:** lucide-react (1.5px stroke)
- **Font:** Inter (Google Fonts)
- **Database:** Supabase (PostgreSQL)

## Phase 2C — Client Onboarding & Management

This phase completes the onboarding flow and administrative controls for managing clients.

### 1. Onboarding Flow
- **Pending Sites**: Admins can see sites sending data that haven't been onboarded yet.
- **Onboarding Modal**: Prefills data from the WordPress plugin (Company ID, Site URL).
- **Atomic Creation**: Creates Auth User, Company Profile, and User Profile in one flow with rollback support.
- **Credentials Toast**: Shows email/password in a secure toast with copy buttons for the admin to share.

### 2. Client Management
- **Suspend/Unsuspend**: Block or restore dashboard access with one click.
- **Reset Password**: Manually set a new password for a client from the admin table.
- **Delete Client**: Permanently remove a client and their profile (while preserving security history).
- **Audit Logs**: Every action is recorded in `activity_logs`.

### 3. Testing Flow
1. Log in as admin → Go to **Clients**.
2. Click **Onboard** on a pending site (e.g., `cybernara`).
3. Fill in details and click **Create Client Account**.
4. Copy the credentials from the success toast.
5. Log out and log in as the new client to verify their restricted view.
6. As admin, try **Suspending** the client and verify they can no longer log in.

## Phase 5 — Alert Generation

Build automatic alert generation for the Cybernara WPShield dashboard. Security events arriving from WordPress sites now automatically create alerts shown to clients and admins.

### 1. Alert Generation Logic
- **File Integrity**: Alerts for any file modification, addition, or deletion.
- **Attack Detection**: Alerts for high/critical security probes (SQLi, XSS, etc.).
- **Role Escalation**: Critical alerts when admin privileges are granted on a site.
- **Brute Force**: High alerts when 3+ failed logins occur from the same IP in 10 minutes.

### 2. Implementation Steps
1.  **Triggers**: Run `supabase/migrations/003_alert_triggers.sql` in the Supabase SQL Editor. This creates the background logic for future events.
2.  **Backfill**: Run `supabase/migrations/003b_backfill_alerts.sql` to generate alerts for all existing security events.
3.  **UI**: The Alerts pages in `/admin` and `/app` are now powered by real data with Acknowledge/Resolve workflows.

### 3. Verification Checklist
- [ ] Run both SQL migrations.
- [ ] Check `alerts` table count → should be ~49.
- [ ] Log in as admin → verify sidebar badge count.
- [ ] Acknowledge an alert → verify it moves to the "Acknowledged" tab.
- [ ] Resolve an alert → verify it moves to the "Resolved" tab.
- [ ] Header bell shows the count of open alerts.
- [ ] Manually insert a `login_failed` row → verify alert appears after 3 attempts.

---

## Folder Structure
... (existing structure) ...
