"use client";

import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface IPCellProps {
  ip: string;
  className?: string;
}

export function IPCell({ ip, className }: IPCellProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      className={cn(
        "group inline-flex items-center gap-1.5 rounded bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-xs cursor-pointer",
        className
      )}
      onClick={handleCopy}
      title="Click to copy"
    >
      {ip}
      {copied ? (
        <Check className="h-3 w-3 text-[var(--success)]" strokeWidth={1.5} />
      ) : (
        <Copy className="h-3 w-3 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.5} />
      )}
    </span>
  );
}
