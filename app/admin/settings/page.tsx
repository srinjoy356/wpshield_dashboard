"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { getGlobalSettingsAction, saveGlobalSettingsAction } from "./actions";

export default function AdminSettingsPage() {
  const tabs = ["Email Configuration", "Alert Thresholds", "Retention Policies"];
  const { toast } = useToast();

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const res = await getGlobalSettingsAction();
      if (res.error) {
        toast({
          title: "Error loading settings",
          description: res.error,
          variant: "destructive",
        });
      } else if (res.settings) {
        setSmtpHost(res.settings.smtp_host || "");
        setSmtpPort(res.settings.smtp_port || "");
        setFromEmail(res.settings.from_email || "");
      }
      setLoading(false);
    }
    loadSettings();
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    const res = await saveGlobalSettingsAction({
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      from_email: fromEmail,
    });
    setSaving(false);

    if (res.error) {
      toast({
        title: "Failed to save settings",
        description: res.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Settings saved",
        description: "SMTP configuration updated successfully.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left tabs */}
        <div className="w-full lg:w-56 shrink-0 space-y-1">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              className={`w-full text-left rounded-lg px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                i === 0
                  ? "bg-[var(--surface-subtle)] font-medium text-[var(--foreground)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <span>{tab}</span>
              {i > 0 && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Coming soon
                </Badge>
              )}
            </button>
          ))}
        </div>
        {/* Right content */}
        <div className="flex-1 rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-sm">
          <h3 className="text-base font-semibold mb-4">Email Configuration</h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--muted)]" />
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="mb-1.5 block text-sm font-medium">SMTP Host</label>
                <Input
                  placeholder="smtp.example.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="bg-surface"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">SMTP Port</label>
                <Input
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="bg-surface"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">From Email</label>
                <Input
                  placeholder="noreply@cybernara.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="bg-surface"
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
