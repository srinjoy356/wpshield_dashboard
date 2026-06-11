"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldOff, Info } from "lucide-react";
import { Company } from "@/types";

interface Props {
  company: Company;
}

export function HardeningControls({ company }: Props) {
  const { toast } = useToast();
  const [xmlrpcDisabled, setXmlrpcDisabled] = useState(
    company.xmlrpc_disabled ?? false
  );
  const [loading, setLoading] = useState(false);

  async function handleToggle(newValue: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/hardening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: company.company_id,
          xmlrpc_disabled: newValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setXmlrpcDisabled(newValue);
      toast({
        title: newValue ? "XML-RPC disabled" : "XML-RPC enabled",
        description: newValue
          ? "The plugin will block all xmlrpc.php requests on next config sync."
          : "XML-RPC is now enabled. The plugin will allow requests on next sync.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* XML-RPC toggle card */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-[var(--surface-subtle)] p-1.5">
              {xmlrpcDisabled
                ? <ShieldCheck className="h-4 w-4 text-[#0D9488]" strokeWidth={1.5} />
                : <ShieldOff className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.5} />
              }
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Disable XML-RPC
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Blocks all requests to <code className="rounded bg-[var(--surface-subtle)] px-1 py-0.5 text-xs font-mono">xmlrpc.php</code>.
                Prevents credential stuffing, DDoS amplification, and plugin exploits
                that target this legacy interface.
              </p>
            </div>
          </div>

          {/* Toggle */}
          <button
            role="switch"
            aria-checked={xmlrpcDisabled}
            disabled={loading}
            onClick={() => handleToggle(!xmlrpcDisabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
              xmlrpcDisabled ? "bg-[#0D9488]" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                xmlrpcDisabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Status line */}
        <div className="mt-4 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${xmlrpcDisabled ? "bg-[#0D9488]" : "bg-amber-400"}`} />
          <p className="text-xs text-[var(--muted)]">
            Current status:{" "}
            <span className={`font-medium ${xmlrpcDisabled ? "text-[#0D9488]" : "text-amber-600"}`}>
              {xmlrpcDisabled ? "XML-RPC is disabled — xmlrpc.php returns 403" : "XML-RPC is enabled — xmlrpc.php is accessible"}
            </span>
          </p>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" strokeWidth={1.5} />
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            <strong>Safe to disable for most sites.</strong> XML-RPC is only needed if you
            use the WordPress mobile app, Jetpack, or a third-party service that connects
            via XML-RPC. If unsure, disable it and monitor for issues.
          </p>
          <p className="text-xs">
            Takes effect within 15 minutes on the next plugin config sync.
          </p>
        </div>
      </div>
    </div>
  );
}