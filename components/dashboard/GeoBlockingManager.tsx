"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Globe, X, Loader2, Info, Search } from "lucide-react";
import { Company, BlockedCountry } from "@/types";
import { COUNTRIES } from "@/lib/countries";
import { EmptyState } from "@/components/dashboard/EmptyState";

interface Props {
  company: Company;
}

export function GeoBlockingManager({ company }: Props) {
  const { toast } = useToast();
  const [blockedCountries, setBlockedCountries] = useState<BlockedCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Search/autocomplete state
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtered country suggestions — exclude already-blocked ones
  const blockedCodes = new Set(blockedCountries.map((c) => c.country_code));
  const suggestions = COUNTRIES.filter(
    (c) =>
      !blockedCodes.has(c.code) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8); // cap at 8 suggestions

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Fetch blocked countries ───────────────────────────────────────────────
  const fetchCountries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/settings/geo-blocking?company_id=${encodeURIComponent(company.company_id)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBlockedCountries(data.data ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [company.company_id, toast]);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  // ── Add a blocked country ─────────────────────────────────────────────────
  async function handleAddCountry(code: string, name: string) {
    setAdding(true);
    setDropdownOpen(false);
    setSearch("");
    try {
      const res = await fetch("/api/settings/geo-blocking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.company_id,
          country_code: code,
          country_name: name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchCountries();
      toast({ title: "Country blocked", description: `${name} has been added to the geo-blocklist.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  // ── Remove a blocked country ──────────────────────────────────────────────
  async function handleRemoveCountry(id: number, name: string) {
    setRemovingId(id);
    try {
      const res = await fetch("/api/settings/geo-blocking", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, company_id: company.company_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBlockedCountries((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Country unblocked", description: `${name} has been removed.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Country search input */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-start gap-3 rounded-md bg-[var(--surface-subtle)] p-3 text-sm text-[var(--muted)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />
          <div>
            <p>
              Country detection uses <strong>ip-api.com</strong> — no API key or Cloudflare required.
            </p>
            <p className="mt-1 text-xs">
              Results are cached per IP for 24 hours. Free tier allows 45 lookups/minute.
            </p>
          </div>
        </div>
        
        <p className="text-sm font-medium text-[var(--foreground)] mb-3">
          Block a Country
        </p>
        <div className="relative">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              strokeWidth={1.5}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search country name or code — e.g. Russia or RU"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDropdownOpen(e.target.value.length > 0);
              }}
              onFocus={() => search.length > 0 && setDropdownOpen(true)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] pl-9 pr-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
            />
            {adding && (
              <Loader2
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--muted)]"
                strokeWidth={1.5}
              />
            )}
          </div>

          {/* Dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden"
            >
              {suggestions.map((country) => (
                <button
                  key={country.code}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur before click fires
                    handleAddCountry(country.code, country.name);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[var(--surface-subtle)] transition-colors"
                >
                  <span className="w-8 shrink-0 rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-center text-xs font-mono font-medium text-[var(--muted)]">
                    {country.code}
                  </span>
                  <span className="text-[var(--foreground)]">{country.name}</span>
                </button>
              ))}
              {search.length > 0 && suggestions.length === 0 && (
                <div className="px-4 py-3 text-sm text-[var(--muted)]">
                  No matching countries found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Blocked countries list */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Blocked Countries
            {blockedCountries.length > 0 && (
              <span className="ml-2 rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-xs text-[var(--muted)]">
                {blockedCountries.length}
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" strokeWidth={1.5} />
          </div>
        ) : blockedCountries.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No countries blocked"
            description="Search for a country above to add it to the geo-blocklist."
            className="border-0 rounded-none py-10"
          />
        ) : (
          <div className="flex flex-wrap gap-2 p-5">
            {blockedCountries.map((entry) => (
              <span
                key={entry.id}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] pl-2 pr-1.5 py-1"
              >
                <span className="rounded bg-white border border-[var(--border)] px-1.5 py-0.5 text-xs font-mono font-medium text-[var(--foreground)]">
                  {entry.country_code}
                </span>
                <span className="text-sm text-[var(--foreground)]">{entry.country_name}</span>
                <button
                  onClick={() => handleRemoveCountry(entry.id, entry.country_name)}
                  disabled={removingId === entry.id}
                  className="ml-0.5 rounded-full p-0.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {removingId === entry.id
                    ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                    : <X className="h-3 w-3" strokeWidth={2} />
                  }
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}