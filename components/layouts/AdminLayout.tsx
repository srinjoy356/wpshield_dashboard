"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Bell,
  Activity,
  Settings,
  Search,
  LogOut,
  LucideIcon,
  Loader2,
  CreditCard,
  FileSignature,
  Package,
  Sun,
  Moon,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/lib/auth/use-user";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCompanyAlertCount } from "@/lib/queries/alerts";
import { logout } from "@/app/(auth)/login/actions";
import { useTheme } from "@/lib/hooks/use-theme";


interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Clients", href: "/admin/clients", icon: Users },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Alerts", href: "/admin/alerts", icon: Bell },
  { label: "Activity Logs", href: "/admin/activity", icon: Activity },
  { label: "Managed Services", href: "/admin/managed-services", icon: FileSignature },
  { label: "Analyst Reviews", href: "/admin/reviews", icon: FileSignature },
  { label: "Plugin Releases", href: "/admin/plugin", icon: Package },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

// Width of the icon-only rail vs the fully expanded sidebar shown on hover.
const RAIL_WIDTH = "w-16";
const EXPANDED_WIDTH = "w-60";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading } = useUser();
  // Hover-driven expand/collapse, replacing the old click-to-toggle +
  // localStorage-persisted state — matches ClientLayout and the DPDP tool's
  // sidebar behavior.
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const { theme, toggleTheme, mounted } = useTheme();

  const expanded = hovered || mobileOpen;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/admin/clients?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    async function fetchCount() {
      try {
        const count = await getCompanyAlertCount(supabase);
        setOpenAlertsCount(count);
      } catch (err) {
        console.error("Failed to fetch alert count:", err);
      }
    }
    fetchCount();
  }, [supabase]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await logout();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
    window.location.href = "/login";
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "AD";
  };

  const pageTitle = (() => {
    const active = adminNav.find((n) => isActive(n.href));
    if (pathname.includes("/clients/new")) return "Onboard Client";
    if (pathname.includes("/clients/")) return "Client Detail";
    return active?.label || "Overview";
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — icon-only rail by default, expands on hover and overlays
          on top of content (rather than pushing it) while expanded. */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--border-1)] bg-[var(--sidebar-bg)]",
          "transition-all duration-300 ease-in-out md:relative",
          expanded ? cn(EXPANDED_WIDTH, "shadow-lg") : RAIL_WIDTH,
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-[var(--border-1)] px-4 shrink-0">
          {!expanded ? (
            <Image
              src="/logos/cn-icon.png"
              alt="Cybernara"
              width={28}
              height={28}
            />
          ) : (
            <div className="flex w-full flex-col">
              <Image
                src="/logos/cybernara-black.png"
                alt="Cybernara"
                width={140}
                height={32}
                className="h-7 w-auto dark:invert"
              />
              <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--sidebar-text)]">
                Admin
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3">
          <ul className="space-y-1">
            {adminNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "nav-item flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-colors",
                    isActive(item.href)
                      ? "active bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] border border-[var(--border-1)] font-semibold"
                      : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-active-text)]"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                  {expanded && (
                    <div className="flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap">
                      <span>{item.label}</span>
                      {item.label === "Alerts" && openAlertsCount > 0 && (
                        <span 
                          className="rounded-full bg-[var(--critical)] px-1.5 py-0.5 text-[10px] font-bold text-white"
                          title={`${openAlertsCount} ${openAlertsCount === 1 ? 'company has' : 'companies have'} open alerts`}
                        >
                          {openAlertsCount}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-[var(--border-1)] p-3 shrink-0">
          {expanded && (
            <div className="mb-3 flex items-center gap-3 px-2 overflow-hidden">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-[var(--bg-3)] text-xs font-medium">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : getInitials(profile?.display_name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-[var(--sidebar-active-text)]">
                  {profile?.display_name || user?.email?.split("@")[0] || "Admin"}
                </p>
                <p className="text-xs text-[var(--sidebar-text)] capitalize">{profile?.role || "Admin"}</p>
              </div>
            </div>
          )}

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              className="flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-active-text)]"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : <Moon className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
              {expanded && <span className="whitespace-nowrap">{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
            </button>
          )}

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm transition-colors text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-active-text)]"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {expanded && <span className="whitespace-nowrap">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main area — margin reserved for the rail width only */}
      <div className="flex flex-1 flex-col overflow-hidden md:ml-16">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-surface px-6">
          {/* Mobile hamburger */}
          <button
            className="md:hidden text-[var(--foreground)]"
            onClick={() => setMobileOpen(true)}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <h2 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">
            {pageTitle}
          </h2>

          <div className="mx-auto hidden w-full max-w-md md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" strokeWidth={1.5} />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-9 pl-9 bg-[var(--surface-subtle)] border-0 focus:ring-2 focus:ring-[var(--foreground)]"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button className="group relative rounded-[var(--radius)] p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]" onClick={() => router.push('/admin/alerts')}>
              <Bell className="h-6 w-6 transition-colors group-hover:text-[var(--foreground)]" strokeWidth={1.5} />
              {openAlertsCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-surface bg-[var(--critical)] px-1 text-[9px] font-bold text-white shadow-sm">
                  {openAlertsCount > 9 ? "9+" : openAlertsCount}
                </span>
              )}
            </button>
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-[var(--surface-subtle)] text-xs font-medium">
                {getInitials(profile?.display_name, user?.email)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8">
            {children}
          </div>
          {/* Footer */}
          <footer className="border-t border-[var(--border)] py-6 text-center">
            <p className="text-xs text-[var(--muted)]">© Cybernara - WPShield 2026</p>
          </footer>
        </main>
      </div>
    </div>
  );
}