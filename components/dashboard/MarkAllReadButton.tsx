"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCheck, Loader2 } from "lucide-react";
import { bulkAcknowledgeAlertsAction } from "@/app/admin/alerts/actions";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MarkAllReadButtonProps {
  companyId?: string;
  openCount: number;
}

export function MarkAllReadButton({ companyId, openCount }: MarkAllReadButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handleMarkAll = () => {
    startTransition(async () => {
      const result = await bulkAcknowledgeAlertsAction(companyId);
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Marked all ${openCount} alerts as read.`,
        });
        setShowConfirm(false);
        router.refresh();
      }
    });
  };

  if (openCount === 0) return null;

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setShowConfirm(true)}
        className="h-9 gap-2 text-xs font-medium border-[var(--border)] bg-surface hover:bg-[var(--surface-subtle)]"
      >
        <CheckCheck className="h-4 w-4" />
        Mark all as read
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mark all as read?</DialogTitle>
            <DialogDescription>
              This will mark all {openCount} open alerts as acknowledged. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button 
              onClick={handleMarkAll}
              disabled={isPending}
              className="bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground)]/90"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, mark all as read
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
