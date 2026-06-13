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
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  LucideIcon,
  Loader2,
  Check,
  CreditCard,
  FileSignature,
  Package,
} from "lucide-react";
import { useState, useTransition, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUser } from "@/lib/auth/use-user";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCompanyAlertCount } from "@/lib/queries/alerts";
import { logout } from "@/app/(auth)/login/actions";


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
  { label: "Analyst Reviews", href: "/admin/reviews", icon: FileSignature },
  { label: "Plugin Releases", href: "/admin/plugin", icon: Package },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile, loading } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = useMemo(() => createClient(), []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/admin/clients?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

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

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--border)] bg-surface transition-all duration-200 md:relative",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-[var(--border)] px-4">
          {collapsed ? (
            <Image
              src="/logos/cn-icon.png"
              alt="Cybernara"
              width={28}
              height={28}
            />
          ) : (
            <Image
              src="/logos/cybernara-black.png"
              alt="Cybernara"
              width={140}
              height={32}
              className="h-8 w-auto"
            />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {adminNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors",
                    isActive(item.href)
                      ? "border-l-2 border-[var(--foreground)] bg-[var(--surface-subtle)] text-[var(--foreground)] font-medium"
                      : "text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                  {!collapsed && (
                    <div className="flex flex-1 items-center justify-between">
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
        <div className="border-t border-[var(--border)] p-3">
          {!collapsed && (
            <div className="mb-3 flex items-center gap-3 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[var(--surface-subtle)] text-xs font-medium">
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : getInitials(profile?.display_name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {profile?.display_name || user?.email?.split("@")[0] || "Admin"}
                </p>
                <p className="text-xs text-[var(--muted)] capitalize">{profile?.role || "Admin"}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm transition-all duration-200 text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            {!collapsed && (
              <span>Logout</span>
            )}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-2 hidden w-full items-center justify-center rounded py-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)] md:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
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
            <button className="group relative rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]" onClick={() => router.push('/admin/alerts')}>
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
