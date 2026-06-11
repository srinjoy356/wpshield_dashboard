"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, UserX, UserCheck } from "lucide-react";
import { Company } from "@/types";
import { suspendClientAction, unsuspendClientAction } from "../actions";
import { useToast } from "@/hooks/use-toast";

interface SuspendConfirmModalProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuspendConfirmModal({
  company,
  open,
  onOpenChange,
}: SuspendConfirmModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const isSuspended = company.status === "suspended";

  const handleToggle = () => {
    // Optimistically close
    onOpenChange(false);
    toast({ title: isSuspended ? "Reactivating..." : "Suspending..." });

    startTransition(async () => {
      const action = isSuspended ? unsuspendClientAction : suspendClientAction;
      const res = await action(company.company_id);

      if (res.success) {
        toast({ 
          title: isSuspended ? "Client reactivated" : "Client suspended",
          description: isSuspended 
            ? `${company.display_name} can now log in again.` 
            : `${company.display_name} will no longer have dashboard access.`
        });
      } else {
        toast({
          title: "Action failed",
          description: res.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuspended ? (
              <UserCheck className="h-5 w-5 text-green-600" />
            ) : (
              <UserX className="h-5 w-5 text-amber-600" />
            )}
            {isSuspended ? "Unsuspend" : "Suspend"} Client?
          </DialogTitle>
          <DialogDescription className="pt-2">
            {isSuspended ? (
              <>
                Are you sure you want to reactivate <strong>{company.display_name}</strong>? 
                This will restore their ability to log in to the dashboard.
              </>
            ) : (
              <>
                Are you sure you want to suspend <strong>{company.display_name}</strong>? 
                They will not be able to log in, but WPShield will continue to 
                collect security data from their site.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant={isSuspended ? "default" : "destructive"}
            onClick={handleToggle}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSuspended ? "Reactivate Account" : "Suspend Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
