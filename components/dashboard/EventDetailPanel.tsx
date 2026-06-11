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
import { AttackEvent } from "@/types";

interface EventDetailPanelProps {
  event: AttackEvent | null;
  open: boolean;
  onClose: () => void;
}

export function EventDetailPanel({ event, open, onClose }: EventDetailPanelProps) {
  if (!event) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">Event #{event.id}</SheetTitle>
          <SheetDescription className="sr-only">Attack event detail view</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={event.severity} />
            <CompanyBadge companyId={event.company_id} />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-[var(--muted)]">Pattern Type</p>
              <p className="font-medium uppercase">{event.pattern_type ?? "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Method</p>
              <p className="font-medium">{event.request_method ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">IP Address</p>
              <IPCell ip={event.ip ?? "0.0.0.0"} />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Occurred</p>
              <TimeCell dateStr={event.occurred_at} />
            </div>
            <div className="col-span-2">
              <p className="text-xs text-[var(--muted)]">URI</p>
              <p className="font-mono text-xs break-all">{event.request_uri ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-[var(--muted)]">User Agent</p>
              <p className="text-xs break-all">{event.user_agent ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Blocked</p>
              <p className={event.blocked ? "text-[var(--success)]" : "text-[var(--critical)]"}>
                {event.blocked ? "Yes" : "No"}
              </p>
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">RAW JSON</p>
            <pre className="max-h-[300px] overflow-auto rounded-lg bg-[var(--surface-subtle)] p-4 text-xs font-mono">
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
