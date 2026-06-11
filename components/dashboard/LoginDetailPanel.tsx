"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SeverityBadge } from "./SeverityBadge";
import { CompanyBadge } from "./CompanyBadge";
import { IPCell } from "./IPCell";
import { TimeCell } from "./TimeCell";
import { Separator } from "@/components/ui/separator";
import { LoginEvent } from "@/types";
import { format } from "date-fns";

interface LoginDetailPanelProps {
  event: LoginEvent | null;
  open: boolean;
  onClose: () => void;
}

export function LoginDetailPanel({ event, open, onClose }: LoginDetailPanelProps) {
  if (!event) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Login Event Details</SheetTitle>
          <SheetDescription className="sr-only">Detailed login event information</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={event.severity || 'low'} />
            <CompanyBadge companyId={event.company_id} />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <p className="text-xs text-[var(--muted)]">Event Type</p>
              <p className="font-medium capitalize">{(event.event ?? "—").replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Username</p>
              <p className="font-medium">{event.login?.trim() || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">IP Address</p>
              <IPCell ip={event.ip ?? "0.0.0.0"} />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Roles</p>
              <p className="font-medium">
                {(() => {
                  if (!event.roles_json) return "—";
                  try {
                    const roles = typeof event.roles_json === 'string' ? JSON.parse(event.roles_json) : event.roles_json;
                    if (Array.isArray(roles)) return roles.join(", ");
                    return String(roles);
                  } catch {
                    return String(event.roles_json);
                  }
                })()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-[var(--muted)]">Time</p>
              <p className="font-medium">
                {format(new Date(event.occurred_at), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-[var(--muted)]">Site</p>
              <p className="text-xs text-blue-600 font-mono">https://cybernara.com</p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">RAW JSON</p>
            <pre className="max-h-[300px] overflow-auto rounded-lg bg-[var(--surface-subtle)] p-4 text-xs font-mono border border-[var(--border)]">
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
