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
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle } from "lucide-react";
import { Company } from "@/types";
import { deleteClientAction } from "../actions";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface DeleteClientModalProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteClientModal({
  company,
  open,
  onOpenChange,
}: DeleteClientModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");

  const handleDelete = () => {
    if (confirmText !== "DELETE") return;

    // Optimistically close and redirect
    onOpenChange(false);
    toast({ title: "Deleting client..." });

    startTransition(async () => {
      const res = await deleteClientAction(company.company_id);

      if (res.success) {
        toast({ 
          title: "Success", 
          description: `Client ${company.display_name} has been permanently deleted` 
        });
        router.push("/admin/clients");
      } else {
        toast({
          title: "Deletion failed",
          description: res.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-red-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Permanently Delete Client?
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              This action is <strong>irreversible</strong>. It will delete the
              company profile, client user accounts, and all pending onboarding
              data for <strong>{company.display_name}</strong>.
            </p>
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-100">
              Security event history in `wpshield_events_*` tables will be
              preserved for compliance, but the client will lose all dashboard
              access.
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <p className="text-sm font-medium">
            Type <span className="font-bold">DELETE</span> to confirm:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="border-red-200 focus-visible:ring-red-500"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || confirmText !== "DELETE"}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Permanently Delete Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
