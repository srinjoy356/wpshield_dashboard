# WPShield Collector — Supabase Edition

Read-only WordPress security telemetry plugin. Captures attack signals, login activity, file integrity events, and plugin/theme/core inventory, then streams them to **Supabase** via its REST API.

## How it works

```
[ WP site (this plugin) ]
     │  collects events into local WP queue table
     ▼
[ WP Cron flush (configurable interval) ]
     │  POST JSON batch to Supabase REST API
     ▼
[ Supabase PostgREST → 4 tables ]
     ├── wpshield_events_attack
     ├── wpshield_events_login
     ├── wpshield_events_file
     └── wpshield_inventory_snapshots
```

The plugin **never blocks traffic** and **never modifies data**. It only observes WordPress hooks, queues events locally, and flushes them to Supabase in batches.

## Setup

### 1. Create the Supabase tables

Open your Supabase project → **SQL Editor** and run `supabase-schema.sql` (included in this zip).

### 2. Get your credentials

- **Project URL**: Supabase → Project Settings → API → Project URL  
  e.g. `https://xxxxxxxxxxxx.supabase.co`
- **Service-role key**: Supabase → Project Settings → API → `service_role` key  
  ⚠️ Keep this secret — it bypasses Row Level Security.

### 3. Install & configure

1. Zip the `wpshield-collector` folder and upload via **Plugins → Add New → Upload Plugin**.
2. Activate the plugin.
3. Go to **WPShield** in the admin sidebar.
4. Fill in **Company ID**, **Supabase Project URL**, and **Service-role key**.
5. Enable the checklist categories you want.
6. Click **Save settings**.
7. Click **Send test ping** — then check your Supabase `wpshield_inventory_snapshots` table.

## Supabase tables

| Table | Event types |
|---|---|
| `wpshield_events_attack` | SQLi, XSS, LFI, RCE, scanner UA, sensitive 404s, XML-RPC calls |
| `wpshield_events_login` | login_success, login_failed, logout, role_changed, user_created |
| `wpshield_events_file` | file_added, file_modified, file_deleted |
| `wpshield_inventory_snapshots` | core, plugins, themes health snapshots (daily) |

Every row includes `company_id` and `site_url` for multi-tenant isolation.

## Row Level Security (optional)

The plugin uses your **service-role key** which bypasses RLS. Once you build a dashboard, enable RLS and create per-tenant policies so your read-only app users can only see their own `company_id` rows. See the commented section at the bottom of `supabase-schema.sql`.

## Configuration fields

| Field | Description |
|---|---|
| **Enable collector** | Master switch |
| **Company ID** | Tenant key stamped on every row (`company1`, `acme`, etc.) |
| **Supabase project URL** | `https://xxxx.supabase.co` |
| **Service-role key** | Secret key — server-side only |
| **Flush interval** | How often the queue is pushed (5 min – 3 hr) |
| **Batch size** | Rows per REST call (10–500) |
| **Checklist** | Per-category opt-in for what data leaves the site |
