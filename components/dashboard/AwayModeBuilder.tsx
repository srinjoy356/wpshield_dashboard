"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Info, Clock, Globe, Plus, X } from "lucide-react";
import { AwayModeSchedule, Company } from "@/types";

// ── IANA timezone list (common ones — covers 99% of users) ─────────────────
const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dhaka",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function buildSummary(schedule: AwayModeSchedule): string {
  if (!schedule.enabled) return "Away mode is disabled. wp-admin is accessible at all times.";

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let dayStr = schedule.allowed_days.length === 0
    ? "no days"
    : compressDays(schedule.allowed_days.sort((a, b) => a - b));

  const start   = formatTime12h(schedule.allowed_start);
  const end     = formatTime12h(schedule.allowed_end);
  const tzShort = getShortTz(schedule.timezone);
  const whitelistNote = schedule.whitelist_ips.length > 0
    ? ` (${schedule.whitelist_ips.length} IP${schedule.whitelist_ips.length > 1 ? "s" : ""} whitelisted)`
    : "";

  return `wp-admin is accessible on ${dayStr} from ${start} to ${end} ${tzShort}.` +
    ` Outside these hours, login is blocked${whitelistNote}.`;
}

function compressDays(days: number[]): string {
  if (days.length === 0) return "no days";
  if (days.length === 7) return "every day";

  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ranges: string[] = [];
  let rangeStart = days[0];
  let prev = days[0];

  for (let i = 1; i <= days.length; i++) {
    const curr = days[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      ranges.push(rangeStart === prev ? names[rangeStart] : `${names[rangeStart]}–${names[prev]}`);
      rangeStart = curr;
      prev = curr;
    }
  }
  return ranges.join(", ");
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")}${ampm}`;
}

function getShortTz(tz: string): string {
  try {
    const now   = new Date();
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(now);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

function defaultSchedule(): AwayModeSchedule {
  return {
    enabled: false,
    timezone: "Asia/Kolkata",
    allowed_days: [1, 2, 3, 4, 5],
    allowed_start: "09:00",
    allowed_end: "18:00",
    whitelist_ips: [],
  };
}

interface SiteOverride {
  id: string;
  url: string;
  away_mode_schedule: AwayModeSchedule | null;
  site_controls_enabled: boolean;
}

interface Props {
  company: Company;
  /** When provided, manages away mode for this specific site only */
  site?: SiteOverride;
}

/**
 * AwayModeBuilder
 *
 * Two modes:
 * - Company mode (no site prop): saves to company-wide away_mode_schedule.
 *   All sites without per-site controls enabled inherit this.
 *
 * - Per-site mode (site prop): saves to sites.away_mode_schedule for that
 *   site only, and sets site_controls_enabled = true.
 */
export function AwayModeBuilder({ company, site }: Props) {
  const { toast } = useToast();

  const isPerSite = !!site;

  // Initialise: per-site takes the site's own schedule; company-level takes company's
  const initialSchedule = isPerSite
    ? (site!.site_controls_enabled && site!.away_mode_schedule
        ? site!.away_mode_schedule
        : company.away_mode_schedule ?? defaultSchedule())
    : (company.away_mode_schedule ?? defaultSchedule());

  const [schedule, setSchedule] = useState<AwayModeSchedule>(initialSchedule);
  const [ipInput, setIpInput]   = useState("");
  const [saving, setSaving]     = useState(false);

  function toggleDay(day: number) {
    setSchedule((prev) => ({
      ...prev,
      allowed_days: prev.allowed_days.includes(day)
        ? prev.allowed_days.filter((d) => d !== day)
        : [...prev.allowed_days, day].sort((a, b) => a - b),
    }));
  }

  function addWhitelistIp() {
    const ip = ipInput.trim();
    if (!ip) return;
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4.test(ip)) {
      toast({ title: "Invalid IP", description: "Enter a valid IPv4 address.", variant: "destructive" });
      return;
    }
    if (schedule.whitelist_ips.includes(ip)) {
      toast({ title: "Already added", description: `${ip} is already in the whitelist.`, variant: "destructive" });
      return;
    }
    setSchedule((prev) => ({ ...prev, whitelist_ips: [...prev.whitelist_ips, ip] }));
    setIpInput("");
  }

  function removeWhitelistIp(ip: string) {
    setSchedule((prev) => ({ ...prev, whitelist_ips: prev.whitelist_ips.filter((i) => i !== ip) }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const endpoint = isPerSite ? "/api/settings/site-away-mode" : "/api/settings/away-mode";
      const payload  = isPerSite
        ? { site_id: site!.id, schedule }
        : { schedule, company_id: company.company_id };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      toast({
        title: "Away mode saved",
        description: isPerSite
          ? `Schedule saved for ${site!.url}. Changes apply on next sync.`
          : "The plugin will apply the new schedule within 15 minutes.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {isPerSite && !site!.site_controls_enabled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Currently inheriting company-wide schedule. Saving will switch this site to per-site control.
        </div>
      )}

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            Enable Away Mode
            {isPerSite && <span className="ml-2 text-xs font-normal text-[var(--muted)]">— this site only</span>}
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Restrict wp-admin access to the hours and days you specify below.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={schedule.enabled}
          onClick={() => setSchedule((p) => ({ ...p, enabled: !p.enabled }))}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            schedule.enabled ? "bg-[#0D9488]" : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              schedule.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {schedule.enabled && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
          {/* Timezone */}
          <div className="p-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <Globe className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
              Timezone
            </label>
            <select
              value={schedule.timezone}
              onChange={(e) => setSchedule((p) => ({ ...p, timezone: e.target.value }))}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {/* Allowed days */}
          <div className="p-5">
            <label className="mb-3 block text-sm font-medium text-[var(--foreground)]">Allowed Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const selected = schedule.allowed_days.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allowed hours */}
          <div className="p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <Clock className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
              Allowed Hours (24-hour format)
            </label>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--muted)]">From</span>
                <input
                  type="time"
                  value={schedule.allowed_start}
                  onChange={(e) => setSchedule((p) => ({ ...p, allowed_start: e.target.value }))}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
                />
              </div>
              <span className="mt-5 text-[var(--muted)]">→</span>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--muted)]">To</span>
                <input
                  type="time"
                  value={schedule.allowed_end}
                  onChange={(e) => setSchedule((p) => ({ ...p, allowed_end: e.target.value }))}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
                />
              </div>
            </div>
          </div>

          {/* IP whitelist */}
          <div className="p-5">
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Whitelisted IPs</label>
            <p className="mb-3 text-xs text-[var(--muted)]">
              These IPs can always access wp-admin regardless of the schedule.
              Add your own IP here before enabling to avoid locking yourself out.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 203.0.113.42"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWhitelistIp()}
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
              />
              <button
                onClick={addWhitelistIp}
                className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-subtle)] transition-colors"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Add
              </button>
            </div>
            {schedule.whitelist_ips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {schedule.whitelist_ips.map((ip) => (
                  <span
                    key={ip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-mono text-[var(--foreground)]"
                  >
                    {ip}
                    <button onClick={() => removeWhitelistIp(ip)} className="text-[var(--muted)] hover:text-[var(--foreground)]">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
        <Info className="h-4 w-4 shrink-0 text-[var(--muted)] mt-0.5" strokeWidth={1.5} />
        <p className="text-sm text-[var(--muted)] leading-relaxed">{buildSummary(schedule)}</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Away Mode Schedule"}
        </button>
      </div>
    </div>
  );
}