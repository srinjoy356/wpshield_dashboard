"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  ShieldAlert, 
  FileText, 
  Key, 
  ChevronDown,
  Loader2,
  MoreHorizontal,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, Severity } from "@/types";
import { acknowledgeAlertAction, resolveAlertAction } from "@/app/admin/alerts/actions";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AlertCardProps {
  alert: Alert;
  isAdmin?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function AlertCard({ alert: initialAlert, isAdmin, isExpanded, onToggle }: AlertCardProps) {
  const [alert, setAlert] = useState(initialAlert);
  const [isPending, startTransition] = useTransition();
  const [isVisible, setIsVisible] = useState(true);
  const { toast } = useToast();

  const severityConfig: Record<Severity, { bg: string; text: string; label: string; border: string }> = {
    critical: { bg: "bg-red-600", text: "text-white", label: "Critical", border: "border-l-red-600" },
    high: { bg: "bg-orange-500", text: "text-white", label: "High", border: "border-l-orange-500" },
    medium: { bg: "bg-amber-500", text: "text-white", label: "Medium", border: "border-l-amber-500" },
    low: { bg: "bg-green-600", text: "text-white", label: "Low", border: "border-l-green-600" },
  };

  const sourceConfig: Record<string, { icon: any; label: string }> = {
    wpshield_events_file: { icon: FileText, label: "File integrity" },
    wpshield_events_attack: { icon: ShieldAlert, label: "Attack detection" },
    wpshield_events_login: { icon: Key, label: "Login activity" },
  };

  const config = severityConfig[alert.severity as Severity] || severityConfig.medium;
  const source = sourceConfig[alert.source_table] || { icon: ShieldAlert, label: "Security event" };

  const handleAction = async (action: "acknowledge" | "resolve") => {
    startTransition(async () => {
      const result = action === "acknowledge" 
        ? await acknowledgeAlertAction(alert.id)
        : await resolveAlertAction(alert.id);

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setIsVisible(false);
        setTimeout(() => {
          toast({
            title: action === "acknowledge" ? "Alert acknowledged" : "Alert resolved",
            description: action === "acknowledge" 
              ? "The alert has been moved to the acknowledged tab." 
              : "The alert has been marked as resolved.",
          });
        }, 200);
      }
    });
  };

  const copyId = () => {
    navigator.clipboard.writeText(alert.id.toString());
    toast({
      description: "Alert ID copied to clipboard",
    });
  };

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[var(--border)] bg-surface transition-all duration-200",
        config.border,
        "border-l-4",
        isExpanded ? "ring-1 ring-inset ring-[var(--border)] shadow-sm" : "hover:bg-[var(--surface-subtle)]/50",
        "animate-in fade-in slide-in-from-top-1 duration-200"
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="p-4">
        {/* Top Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
            <span className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              config.bg,
              config.text
            )}>
              {config.label}
            </span>
            <h3 className="text-[15px] font-semibold text-[var(--foreground)] leading-tight">
              {alert.title}
            </h3>
          </div>
          
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {alert.status === "open" && (
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 text-xs px-3 font-semibold bg-[var(--surface-subtle)] hover:bg-[var(--border)] border border-[var(--border)] shadow-sm"
                onClick={() => handleAction("acknowledge")}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Acknowledge
              </Button>
            )}
            
            {alert.status === "acknowledged" && (
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 text-xs px-3 font-semibold bg-[var(--surface-subtle)] hover:bg-[var(--border)] border border-[var(--border)] shadow-sm"
                onClick={() => handleAction("resolve")}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Resolve
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-[var(--surface-subtle)]">
                  <MoreHorizontal className="h-4 w-4 text-[var(--muted)]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onToggle}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  {isExpanded ? "Collapse details" : "View details"}
                </DropdownMenuItem>
                
                {alert.status === "open" && (
                  <DropdownMenuItem onClick={() => handleAction("resolve")}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                    Quick Resolve
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem onClick={copyId}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Alert ID
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/clients/${alert.company_id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Client Profile
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-subtle)] md:hidden",
              isExpanded && "bg-[var(--surface-subtle)]"
            )}>
              <ChevronDown className={cn("h-4 w-4 text-[var(--muted)] transition-transform duration-200", isExpanded && "rotate-180")} />
            </div>
          </div>
        </div>

        {/* Sub-header Row */}
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-1">
            <source.icon className="h-3.5 w-3.5" />
            <span>{source.label}</span>
          </div>
          
          <span className="text-[var(--border)]">•</span>
          
          {isAdmin && (
            <>
              <Link 
                href={`/admin/clients/${alert.company_id}`}
                className="font-mono hover:text-[var(--foreground)] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {alert.company_id}
              </Link>
              <span className="text-[var(--border)]">•</span>
            </>
          )}

          {alert.site_url && (
            <>
              <span className="text-[var(--border)]">•</span>
              <span className="truncate max-w-[180px] italic">{alert.site_url}</span>
            </>
          )}

          <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
        </div>

        {/* Expanded Description */}
        <div 
          className={cn(
            "grid transition-all duration-200 ease-in-out",
            isExpanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                {alert.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}