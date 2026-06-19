"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "wpshield_theme";

/**
 * Shared light/dark theme toggle, used by both ClientLayout and AdminLayout
 * so the two sidebars stay in sync rather than duplicating this logic twice.
 * Mirrors Tailwind's `darkMode: ["class"]` config (already set in
 * tailwind.config.ts but previously unused) by toggling a `dark` class on
 * <html>, with the choice persisted to localStorage the same way the
 * existing sidebar-collapsed state already is elsewhere in this codebase.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = saved === "dark" ? "dark" : "light";
    setThemeState(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: "light" | "dark") => {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme, mounted };
}