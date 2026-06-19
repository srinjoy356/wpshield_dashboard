"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SiteSwitcherOption {
  key: string;
  label: string;
}

interface SiteSwitcherProps {
  sites: SiteSwitcherOption[];
  value: string;
  /** Used by pages that hold the selected site in client state (e.g. Hardening). */
  onChange?: (key: string) => void;
  /**
   * Used by pages that select the site via a URL search param instead of
   * client state (e.g. Inventory, which is a server component). The URL is
   * built internally as `${basePath}?${searchParam}=${key}` — deliberately
   * plain strings, not a function. Next.js Server Components cannot pass
   * functions as props to Client Components (only serializable data crosses
   * that boundary), so an earlier version of this component that took a
   * `hrefFor: (key) => string` callback threw at runtime the moment a server
   * component tried to use it. Strings serialize fine; functions don't.
   */
  basePath?: string;
  /** Search param name used with basePath. Defaults to 'site'. */
  searchParam?: string;
  className?: string;
}

/**
 * Dropdown-style site/company switcher, replacing the earlier pill-button
 * row. Renders nothing when there's only one site — matching the previous
 * pill row's behavior of staying hidden until there's actually a choice to
 * make.
 *
 * Built on the existing Radix-based Select component rather than a native
 * <select>, specifically so every part of the open dropdown — background,
 * borders, hover/selected state — can be styled to match the monochrome
 * system. A native <select>'s open list is rendered by the OS/browser and
 * can't be restyled this way (its blue highlight color is browser chrome,
 * not something the page's CSS controls).
 */
export function SiteSwitcher({ sites, value, onChange, basePath, searchParam = "site", className }: SiteSwitcherProps) {
  const router = useRouter();

  if (sites.length <= 1) return null;

  const handleChange = (key: string) => {
    if (basePath) {
      router.push(`${basePath}?${searchParam}=${encodeURIComponent(key)}`);
    } else if (onChange) {
      onChange(key);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger
        className={cn(
          "w-[280px] h-10 rounded-[var(--radius)] border-[var(--border-2)] bg-[var(--bg-2)]",
          "text-sm font-medium text-[var(--text-1)]",
          "hover:bg-[var(--bg-3)] transition-colors",
          className
        )}
      >
        <SelectValue placeholder="Select site" />
      </SelectTrigger>
      <SelectContent className="rounded-[var(--radius)] border-[var(--border-2)] bg-[var(--surface)]">
        {sites.map((s) => (
          <SelectItem
            key={s.key}
            value={s.key}
            className="text-sm focus:bg-[var(--sidebar-active-bg)] focus:text-[var(--text-1)] data-[state=checked]:font-semibold"
          >
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}