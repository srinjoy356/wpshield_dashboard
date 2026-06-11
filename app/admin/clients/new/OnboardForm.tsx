"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PendingCompany } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { onboardClientAction } from "./actions";
import {
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface OnboardFormProps {
  pending?: PendingCompany | null;
}

export function OnboardForm({ pending }: OnboardFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [form, setForm] = useState({
    company_id: pending?.company_id || "",
    site_url: pending?.site_url || "",
    display_name: "",
    contact_email: "",
    password: "",
    notes: "",
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));

      const result = await onboardClientAction(formData, !!pending);

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.credentials) {
        const { email, company_id, display_name } = result.credentials;

        // Trigger Invitation
        try {
          const inviteRes = await fetch("/api/send-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_id, email }),
          });

          if (!inviteRes.ok) {
            toast({
              title: "Client created, but invite failed ⚠️",
              description: "Please try resending the invite from the dashboard.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Client onboarded & invite sent ✅",
              description: `Invitation email sent to ${email}.`,
            });
          }
        } catch (err) {
          toast({
            title: "Client created, but invite failed ⚠️",
            description: "Connection error while sending invite.",
            variant: "destructive",
          });
        }

        router.push("/admin/clients");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Site URL */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Site URL {pending && "(from WordPress plugin)"}</label>
        {pending ? (
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
            <span>{form.site_url}</span>
            <a href={form.site_url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <Input
            value={form.site_url}
            onChange={(e) => setForm({ ...form, site_url: e.target.value })}
            placeholder="https://example.com"
            className="bg-surface"
          />
        )}
      </div>

      {/* Company ID */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Company ID</label>
        {pending ? (
          <div>
            <div className="inline-block rounded-md bg-[var(--surface-subtle)] border border-[var(--border)] px-3 py-1 font-mono text-sm font-medium">
              {form.company_id}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              This is the technical key from the WordPress plugin. It cannot be changed.
            </p>
          </div>
        ) : (
          <Input
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            placeholder="e.g. acme-corp"
            required
            className="bg-surface font-mono"
          />
        )}
      </div>

      {/* Display Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Display Name <span className="text-[var(--critical)]">*</span></label>
        <Input
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          placeholder="e.g. Cybernara Pvt. Ltd."
          required
          className="bg-surface"
        />
      </div>

      {/* Contact Email */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Contact Email <span className="text-[var(--critical)]">*</span></label>
        <Input
          type="email"
          value={form.contact_email}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          placeholder="client@example.com"
          required
          className="bg-surface"
        />
        <p className="text-[11px] text-[var(--muted)]">Used as the login email for this client</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Internal notes (visible only to admins)"
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => router.push("/admin/clients")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} className="min-w-[140px]">
          {isPending ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating...</span>
            </div>
          ) : (
            "Create Client Account"
          )}
        </Button>
      </div>
    </form>
  );
}
