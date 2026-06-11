"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, Send, Loader2 } from "lucide-react";
import { Company } from "@/types";
import { Input } from "@/components/ui/input";

// 1. Fixed the Type Error by mapping exact string literals
const SEVERITY_OPTIONS = [
  { value: "low",      label: "Low & above",      description: "Every alert" },
  { value: "medium",   label: "Medium & above",    description: "Skips low-noise events" },
  { value: "high",     label: "High & above",      description: "Recommended" },
  { value: "critical", label: "Critical only",     description: "Only the most urgent" },
] as const;

// 2. Inline Slack Icon component to bypass outdated lucide-react versions
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="3" height="8" x="13" y="2" rx="1.5" />
      <path d="M19 8.5a1.5 1.5 0 1 0 0-3h-3v3z" />
      <rect width="8" height="3" x="14" y="13" rx="1.5" />
      <path d="M15.5 19a1.5 1.5 0 1 0 3 0v-3h-3z" />
      <rect width="3" height="8" x="8" y="14" rx="1.5" />
      <path d="M5 15.5a1.5 1.5 0 1 0 0 3h3v-3z" />
      <rect width="8" height="3" x="2" y="8" rx="1.5" />
      <path d="M8.5 5a1.5 1.5 0 1 0-3 0v3h3z" />
    </svg>
  );
}

interface Props {
  company: Company;
}

export function NotificationSettings({ company }: Props) {
  const { toast } = useToast();

  const MASKED_WEBHOOK = "••••••••••••••••••••••••••••";
  const [email, setEmail]         = useState(company.notify_email ?? "");
  const [slack, setSlack]         = useState(company.notify_slack_webhook ? MASKED_WEBHOOK : "");
  const [threshold, setThreshold] = useState(company.notify_severity_threshold ?? "high");
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.company_id,
          notify_email: email || null,
          notify_slack_webhook: slack === MASKED_WEBHOOK ? company.notify_slack_webhook : (slack || null),
          notify_severity_threshold: threshold,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Saved", description: "Notification preferences updated." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!email && !slack) {
      toast({
        title: "No channels configured",
        description: "Add an email or Slack webhook before sending a test.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/notify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.company_id,
          site_url: company.site_url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: "Test sent",
        description: "Check your email and/or Slack for the test notification.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Email */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <Mail className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
          Email Notifications
        </label>
        <Input
          type="email"
          placeholder="alerts@yourcompany.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-[var(--surface-subtle)] border-[var(--border)]"
        />
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          Receive a formatted HTML alert email when an event meets your threshold.
        </p>
      </div>

      {/* Slack */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <SlackIcon className="h-4 w-4 text-[var(--muted)]" />
          Slack Webhook
        </label>
        <Input
          type="url"
          placeholder="https://hooks.slack.com/services/..."
          value={slack}
          onChange={(e) => setSlack(e.target.value)}
          className="bg-[var(--surface-subtle)] border-[var(--border)]"
        />
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          Create an incoming webhook in your Slack workspace and paste the URL here.
        </p>
      </div>

      {/* Threshold */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
          <Bell className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
          Severity Threshold
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEVERITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setThreshold(opt.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                threshold === opt.value
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--border)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <p className={`text-xs font-semibold ${threshold === opt.value ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                {opt.label}
              </p>
              <p className={`text-xs mt-0.5 ${threshold === opt.value ? "text-[var(--background)] opacity-70" : "text-[var(--muted)]"}`}>
                {opt.description}
              </p>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Only alerts at or above this severity level will trigger notifications.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleTest}
          disabled={testing || saving}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--surface-subtle)] disabled:opacity-50 transition-colors"
        >
          {testing
            ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            : <Send className="h-4 w-4" strokeWidth={1.5} />
          }
          {testing ? "Sending test…" : "Send Test Notification"}
        </button>

        <button
          onClick={handleSave}
          disabled={saving || testing}
          className="rounded-lg bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}