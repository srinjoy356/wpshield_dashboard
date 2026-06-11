"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { Company, CompanyStatus } from "@/types";
import { updateClientAction } from "../actions";
import { useToast } from "@/hooks/use-toast";

interface ClientEditModalProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientEditModal({ company, open, onOpenChange }: ClientEditModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    display_name: company.display_name,
    contact_email: company.contact_email,
    notes: company.notes || "",
    status: company.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Optimistically close
    onOpenChange(false);
    toast({ title: "Updating client..." });

    startTransition(async () => {
      const res = await updateClientAction(company.company_id, formData);

      if (res.success) {
        toast({ title: "Client updated successfully" });
      } else {
        toast({
          title: "Update failed",
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
          <DialogTitle>Edit Client Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name</label>
            <Input
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Contact Email</label>
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(e) =>
                setFormData({ ...formData, contact_email: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as CompanyStatus })
              }
              className="w-full h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Internal)</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Internal notes about this client..."
              rows={3}
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
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}