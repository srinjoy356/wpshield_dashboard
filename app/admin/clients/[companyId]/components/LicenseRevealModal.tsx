"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, Copy, Check, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LicenseRevealModalProps {
  licenseId: string;
  /** 'reveal' shows the key on screen; 'resend' emails it to the customer instead. */
  action: "reveal" | "resend";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "sending_otp" | "awaiting_code" | "verifying" | "done" | "error";

/**
 * Two-step OTP gate in front of a sensitive action (viewing or resending a
 * customer's raw license key). Opening this dialog immediately requests an
 * OTP sent to the ADMIN'S OWN email — not the customer's — proving it's
 * really the logged-in admin taking this action right now, not just someone
 * with access to an already-open browser tab.
 */
export function LicenseRevealModal({ licenseId, action, open, onOpenChange }: LicenseRevealModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("sending_otp");
  const [code, setCode] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [resentTo, setResentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const requestOtp = async () => {
    setStep("sending_otp");
    setError(null);
    try {
      const res = await fetch(`/api/admin/licenses/${licenseId}/request-reveal-otp`, {
        method: "POST",
        // 15s — generous enough for a real email send, but bounded so the
        // dialog can never get stuck on "Sending verification code..."
        // indefinitely if something server-side hangs in a way the server's
        // own timeouts didn't catch. The server-side fix (timeouts on the
        // Graph API calls in lib/email.ts) is the real fix; this is a
        // backstop so the UI fails visibly either way.
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send verification code");
      setStep("awaiting_code");
    } catch (err: any) {
      const message = (err.name === "TimeoutError" || err.name === "AbortError")
        ? "Request timed out — the verification email may not have sent. Try again."
        : err.message;
      setError(message);
      setStep("error");
    }
  };

  // Send the OTP the moment the dialog opens, rather than requiring an extra click.
  const handleOpenChange = (next: boolean) => {
    if (next && step !== "awaiting_code") {
      requestOtp();
    }
    if (!next) {
      // Reset state on close so reopening starts fresh.
      setStep("sending_otp");
      setCode("");
      setRevealedKey(null);
      setResentTo(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setStep("verifying");
    setError(null);

    try {
      const endpoint = action === "reveal"
        ? `/api/admin/licenses/${licenseId}/confirm-reveal`
        : `/api/admin/licenses/${licenseId}/resend-email`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      if (action === "reveal") {
        setRevealedKey(data.licenseKey);
      } else {
        setResentTo(data.sentTo);
        toast({ title: "Email sent", description: `License key resent to ${data.sentTo}` });
      }
      setStep("done");
    } catch (err: any) {
      setError(err.message);
      setCode("");
      setStep("awaiting_code");
    }
  };

  const copyKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {action === "reveal" ? "Reveal License Key" : "Resend License Key"}
          </DialogTitle>
          <DialogDescription>
            {step === "done"
              ? "Verification complete."
              : "A verification code has been sent to your admin email. This action is logged."}
          </DialogDescription>
        </DialogHeader>

        {step === "sending_otp" && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Sending verification code...
          </div>
        )}

        {(step === "awaiting_code" || step === "verifying") && (
          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-lg tracking-[0.3em] font-mono"
            />
            {error && <p className="text-sm text-[var(--critical)]">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={requestOtp} disabled={step === "verifying"}>
                Resend code
              </Button>
              <Button type="submit" disabled={code.length !== 6 || step === "verifying"}>
                {step === "verifying" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verify
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "done" && action === "reveal" && revealedKey && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3 font-mono text-sm break-all">
              {revealedKey}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={copyKey} className="gap-2">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy to clipboard"}
            </Button>
            <p className="text-xs text-[var(--muted)]">This reveal has been logged for audit purposes.</p>
          </div>
        )}

        {step === "done" && action === "resend" && resentTo && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <Mail className="h-4 w-4 shrink-0" />
            Sent to {resentTo}
          </div>
        )}

        {step === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--critical)]">{error}</p>
            <Button type="button" size="sm" onClick={requestOtp}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}