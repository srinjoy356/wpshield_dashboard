# Client Side Audit Report
Generated: 2026-05-10

## Page: /app (Overview)
### Buttons & interactions:
| Element | Expected behavior | Actual behavior | Status |
|---|---|---|---|
| Stat Card "My Events Today" | Show count of today's events | Shows data from getClientStats | ✅ |
| Stat Card "Open Alerts" | Show current open alerts count | Shows data from getClientStats | ✅ |
| Stat Card "Site Status" | Show "Healthy" or "Attention" | Correctly reflects profile status | ✅ |
| Stat Card "Last Heartbeat" | Show relative time since last seen | Uses TimeCell for relative formatting | ✅ |
| Line Chart | Render events trend for last 7 days | Renders real data; shows empty state if none | ✅ |
| Donut Chart | Render severity distribution | Renders real data; shows empty state if none | ✅ |
| Recent Events List | Show latest 6 attack events | Lists events with severity badges and IPs | ✅ |
| Quick Link "View Attacks" | Navigate to /app/attacks | Functional Link component | ✅ |
| Quick Link "View Logins" | Navigate to /app/logins | Functional Link component | ✅ |
| Quick Link "View File Changes" | Navigate to /app/files | Functional Link component | ✅ |
| Quick Link "View Inventory" | Navigate to /app/inventory | Functional Link component | ✅ |
| Notification Bell | Show badge and navigate to Alerts | Functional badge; clicks navigate correctly | ✅ |
| Search Bar (Header) | Search across the platform | Decorative input with no logic | 🚧 |
| User Avatar (Header) | Open profile menu | Clickable but does not open a menu | 🚧 |
| Sidebar Collapse | Toggle sidebar width | Functional using internal state | ✅ |
| Sidebar Nav Items | Navigate to respective pages | Functional Link components with active states | ✅ |
| Logout Button | Sign out and redirect to /login | Correctly calls signOut() and redirects | ✅ |

## Page: /app/attacks
### Buttons & interactions:
| Element | Expected behavior | Actual behavior | Status |
|---|---|---|---|
| Time tab "24h" | Filter table to last 24 hours | Functional client-side filtering | ✅ |
| Time tab "7d" | Filter table to last 7 days | Functional client-side filtering | ✅ |
| Time tab "30d" | Filter table to last 30 days | Functional client-side filtering | ✅ |
| Time tab "Custom" | Show date picker | Shows start/end date inputs and filters | ✅ |
| Pattern Type filter | Filter table by attack pattern | Functional client-side filtering | ✅ |
| Severity filter | Filter table by severity | Functional client-side filtering | ✅ |
| Search input | Filter IP, URI, User Agent | Functional real-time search | ✅ |
| Export CSV button | Download CSV file | Decorative button; no action wired | 🚧 |
| Click row | Open side panel with details | Functional; opens EventDetailPanel | ✅ |
| Side panel close | Close the details panel | Functional; wired to state | ✅ |
| JSON Viewer | Show raw request data | Renders formatted JSON correctly | ✅ |

## Page: /app/logins
### Buttons & interactions:
| Element | Expected behavior | Actual behavior | Status |
|---|---|---|---|
| Time range tabs | Filter logins by time | Functional client-side filtering | ✅ |
| Event type filter | Filter by Login/Logout/etc. | Functional client-side filtering | ✅ |
| Search input | Filter user or IP | Functional real-time search | ✅ |
| Export CSV button | Download CSV file | Decorative button; no action wired | 🚧 |
| Click row | Open side panel with details | Functional; opens LoginDetailPanel | ✅ |
| Row highlighting | Highlight failed logins | Distinct red border and background | ✅ |

## Page: /app/files
### Buttons & interactions:
| Element | Expected behavior | Actual behavior | Status |
|---|---|---|---|
| Time range tabs | Filter file events by time | Functional client-side filtering | ✅ |
| Event type filter | Filter by Added/Modified/Deleted | Functional client-side filtering | ✅ |
| Search input | Filter by file path | Functional real-time search | ✅ |
| Export CSV button | Download CSV file | Decorative button; no action wired | 🚧 |
| Click row | Open side panel with details | Functional; opens Sheet with hash comparison | ✅ |
| Hash Comparison | Show old_hash vs new_hash | Correctly renders comparison in side panel | ✅ |
| File size format | Show size in KB | Correctly formats (Size / 1024).toFixed(1) | ✅ |

## Page: /app/inventory
### Buttons & interactions:
| Element | Expected behavior | Actual behavior | Status |
|---|---|---|---|
| WP Version card | Show real version and last check | Functional; pulls from latest snapshot | ✅ |
| PHP Version card | Show real PHP version | Functional; pulls from latest snapshot | ✅ |
| Last Snapshot card | Show relative time of last update | Functional; uses TimeCell | ✅ |
| Plugins tab | Show list of plugins | Functional shadcn/ui Tabs integration | ✅ |
| Themes tab | Show list of themes | Functional shadcn/ui Tabs integration | ✅ |
| Plugin search input | Filter plugin list | Functional real-time filter | ✅ |
| Theme search input | Filter theme list | Functional real-time filter | ✅ |
| Update indicator | Show "X available" for plugins | Functional; checks update_pending flag | ✅ |
| Active/Inactive badge | Show status of asset | Functional; colors match status correctly | ✅ |

## Page: /app/alerts
### Buttons & interactions:
| Element | Expected behavior | Actual behavior | Status |
|---|---|---|---|
| Tab counts | Show number of alerts per status | Functional; calculated from initialAlerts | ✅ |
| Search filter | Search title and description | Functional real-time search | ✅ |
| Source filter | Filter by specific event source | Functional Select integration | ✅ |
| Severity filter | Filter by severity level | Functional Select integration | ✅ |
| Clear filters | Reset all filter states | Functional; appears only when filters active | ✅ |
| Alert card click | Expand for full description | Functional; smooth accordion transition | ✅ |
| Actions Menu (...) | Show secondary actions | Recently added functional DropdownMenu | ✅ |
| Acknowledge button | Move alert to Acknowledged tab | Functional server action with optimistic UI | ✅ |
| Mark all as read | Bulk acknowledge all open alerts | Functional with confirmation dialog | ✅ |
| Resolve button | Move alert to Resolved tab | Functional in Acknowledged tab | ✅ |
| Sidebar badge | Reflect total open alerts | Functional; fetched globally in layout | ✅ |

## Page: /app/settings
### Buttons & interactions:
| Element | Expected behavior | Actual behavior | Status |
|---|---|---|---|
| Navigation Tabs | Switch settings sections | Functional tab switching | ✅ |
| Name field | Edit display name | Editable and persists to Supabase | ✅ |
| Email field | Edit email address | Editable and persists to Company record | ✅ |
| Save Changes button | Persist settings to database | Functional server action wired | ✅ |
| Change Password form | Functional form to update pw | Fully functional with validation | ✅ |
| Toggle switches | Toggle notification settings | **NOT BUILT** — shows "Soon" badge | 🚧 |

═══════════════════════════════════════════════════════════════════════
STATUS LEGEND
═══════════════════════════════════════════════════════════════════════

✅ Working — functions exactly as expected
⚠️ Partial — works but with issues (describe what's wrong)
❌ Broken — does nothing or throws error
🚧 Not built — placeholder/coming soon (intentional)

═══════════════════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════════════════

### ✅ Working (56 items)
- All main navigation links
- Alert management system (Full functionality)
- Inventory management and search
- Attack/Login/File event side panels and JSON viewer
- Overview charts and stats
- Logout flow and sidebar collapse
- Time range filtering (including custom dates)
- Search inputs on all event pages
- Settings persistence and password management

### 🚧 Not built / Placeholder (7 items)
- Header Search (Global)
- User Profile Dropdown Menu
- Export CSV (All pages)
- Notification Preferences Section
- Account Settings Persistence (Now fixed)

### Priority fix list
- [x] Settings Persistence
- [x] Logins Detail Panel
- [x] Time Filtering Wiring
- [x] Logins/Files Search
- [x] Change Password Form
