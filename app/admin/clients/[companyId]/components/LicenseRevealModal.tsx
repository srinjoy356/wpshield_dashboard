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

// All logs prefixed [LicenseRevealModal] so they're easy to filter in the
// browser console (DevTools console search box: type "LicenseRevealModal").
// Temporary diagnostic logging — added to trace exactly where the "stuck on
// Sending verification code..." UI state was actually breaking down, since
// the underlying API was confirmed working via a direct fetch() test but the
// React component wasn't reflecting that. Safe to strip out once confirmed
// fixed, but harmless to leave; these are plain console.log, not gated by
// any debug flag, since this is browser-side and never touches a server log.
export function LicenseRevealModal({ licenseId, action, open, onOpenChange }: LicenseRevealModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("sending_otp");
  const [code, setCode] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [resentTo, setResentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  console.log("[LicenseRevealModal] render — open:", open, "step:", step, "licenseId:", licenseId);

  const requestOtp = async () => {
    console.log("[LicenseRevealModal] requestOtp() called");
    setStep("sending_otp");
    setError(null);
    try {
      console.log("[LicenseRevealModal] requestOtp: about to fetch...");
      const res = await fetch(`/api/admin/licenses/${licenseId}/request-reveal-otp`, {
        method: "POST",
        signal: AbortSignal.timeout(15000),
      });
      console.log("[LicenseRevealModal] requestOtp: fetch resolved, status:", res.status);
      const data = await res.json();
      console.log("[LicenseRevealModal] requestOtp: body parsed:", data);
      if (!res.ok) throw new Error(data.error || "Failed to send verification code");
      console.log("[LicenseRevealModal] requestOtp: SUCCESS — calling setStep('awaiting_code')");
      setStep("awaiting_code");
    } catch (err: any) {
      console.log("[LicenseRevealModal] requestOtp: CAUGHT ERROR —", err.name, err.message);
      const message = (err.name === "TimeoutError" || err.name === "AbortError")
        ? "Request timed out — the verification email may not have sent. Try again."
        : err.message;
      setError(message);
      setStep("error");
    }
  };

  const handleOpenChange = (next: boolean) => {
    console.log("[LicenseRevealModal] handleOpenChange called — next:", next, "current step:", step);
    if (next && step !== "awaiting_code") {
      console.log("[LicenseRevealModal] handleOpenChange: triggering requestOtp()");
      requestOtp();
    }
    if (!next) {
      console.log("[LicenseRevealModal] handleOpenChange: closing, resetting state");
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
    console.log("[LicenseRevealModal] handleVerify() called, code length:", code.length);
    if (code.length !== 6) return;
    setStep("verifying");
    setError(null);

    try {
      const endpoint = action === "reveal"
        ? `/api/admin/licenses/${licenseId}/confirm-reveal`
        : `/api/admin/licenses/${licenseId}/resend-email`;
      console.log("[LicenseRevealModal] handleVerify: posting to", endpoint);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      console.log("[LicenseRevealModal] handleVerify: status", res.status);
      const data = await res.json();
      console.log("[LicenseRevealModal] handleVerify: body", data);
      if (!res.ok) throw new Error(data.error || "Verification failed");

      if (action === "reveal") {
        setRevealedKey(data.licenseKey);
      } else {
        setResentTo(data.sentTo);
        toast({ title: "Email sent", description: `License key resent to ${data.sentTo}` });
      }
      console.log("[LicenseRevealModal] handleVerify: SUCCESS — calling setStep('done')");
      setStep("done");
    } catch (err: any) {
      console.log("[LicenseRevealModal] handleVerify: CAUGHT ERROR —", err.message);
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