"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { InventorySnapshotView } from "@/types";

interface InventoryListProps {
  snapshot: InventorySnapshotView | null;
}

export function InventoryList({ snapshot }: InventoryListProps) {
  const [pluginSearch, setPluginSearch] = useState("");
  const [themeSearch, setThemeSearch] = useState("");

  const plugins = snapshot?.plugins ?? [];
  const themes = snapshot?.themes ?? [];

  const filteredPlugins = plugins.filter((p) =>
    (p.name ?? "").toLowerCase().includes(pluginSearch.toLowerCase())
  );
  const filteredThemes = themes.filter((t) =>
    (t.name ?? "").toLowerCase().includes(themeSearch.toLowerCase())
  );

  return (
    <Tabs defaultValue="plugins">
      <TabsList>
        <TabsTrigger value="plugins">Plugins ({snapshot?.pluginCount ?? 0})</TabsTrigger>
        <TabsTrigger value="themes">Themes ({snapshot?.themeCount ?? 0})</TabsTrigger>
      </TabsList>
      <TabsContent value="plugins" className="mt-4 space-y-4">
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search plugins..."
            value={pluginSearch}
            onChange={(e) => setPluginSearch(e.target.value)}
            className="pl-9 bg-surface"
          />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="px-6 py-3 font-medium">Plugin Name</th>
                <th className="px-6 py-3 font-medium">Version</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Update</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlugins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-[var(--muted)]">
                    No plugins found matching your search.
                  </td>
                </tr>
              ) : (
                filteredPlugins.map((p) => (
                  <tr
                    key={p.slug || p.name}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]"
                  >
                    <td className="px-6 py-3 text-sm font-medium">{p.name ?? "Unknown"}</td>
                    <td className="px-6 py-3 text-sm font-mono">{p.version ?? "—"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          p.is_active
                            ? "bg-green-50 text-[var(--success)]"
                            : "bg-gray-100 text-[var(--muted)]"
                        }`}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {!p.update_pending ? (
                        <span className="text-[var(--success)] font-medium">Up to date</span>
                      ) : (
                        <span className="text-[var(--warning)] font-medium">
                          v{p.new_version || "—"} available
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TabsContent>
      <TabsContent value="themes" className="mt-4 space-y-4">
        <div className="relative max-w-sm">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Search themes..."
            value={themeSearch}
            onChange={(e) => setThemeSearch(e.target.value)}
            className="pl-9 bg-surface"
          />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="px-6 py-3 font-medium">Theme Name</th>
                <th className="px-6 py-3 font-medium">Version</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Update</th>
              </tr>
            </thead>
            <tbody>
              {filteredThemes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-[var(--muted)]">
                    No themes found matching your search.
                  </td>
                </tr>
              ) : (
                filteredThemes.map((t) => (
                  <tr
                    key={t.slug || t.name}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)]"
                  >
                    <td className="px-6 py-3 text-sm font-medium">{t.name ?? "Unknown"}</td>
                    <td className="px-6 py-3 text-sm font-mono">{t.version ?? "—"}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          t.is_active
                            ? "bg-green-50 text-[var(--success)]"
                            : "bg-gray-100 text-[var(--muted)]"
                        }`}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {!t.update_pending ? (
                        <span className="text-[var(--success)] font-medium">Up to date</span>
                      ) : (
                        <span className="text-[var(--warning)] font-medium">
                          v{t.new_version || "—"} available
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
