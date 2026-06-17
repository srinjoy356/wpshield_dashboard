"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusDot } from "@/components/dashboard/StatusDot";
import { TimeCell } from "@/components/dashboard/TimeCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Company } from "@/types";
import {
  Search,
  MoreHorizontal,
  ShieldAlert,
  Key,
  Trash2,
  Lock,
  Unlock,
  Loader2,
  Copy,
  Check,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  suspendClientAction, 
  unsuspendClientAction,
  resetClientPasswordAction, 
  deleteClientAction 
} from "@/app/admin/clients/[companyId]/actions";

interface ClientsListProps {
  initialCompanies: Company[];
}

export function ClientsList({ initialCompanies }: ClientsListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    type: 'suspend' | 'delete' | 'reset',
    company: Company | null
  }>({ type: 'suspend', company: null });

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = initialCompanies.filter((c) => {
    const matchesSearch =
      c.company_id.toLowerCase().includes(search.toLowerCase()) ||
      c.display_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.firstSiteUrl || c.site_url || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const [isPending, startTransition] = useTransition();

  const handleSuspend = async (company: Company) => {
    const isSuspended = company.status === "suspended";
    
    startTransition(async () => {
      setLoadingAction(`suspend-${company.company_id}`);
      const res = isSuspended 
        ? await unsuspendClientAction(company.company_id)
        : await suspendClientAction(company.company_id);

      if (res.error) {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
      } else {
        toast({ title: isSuspended ? "Client reactivated" : "Client suspended" });
      }
      setLoadingAction(null);
      setConfirmModal({ type: 'suspend', company: null });
    });
  };

  const handleResendInvite = async (company: Company) => {
    startTransition(async () => {
      setLoadingAction(`invite-${company.company_id}`);
      try {
        const res = await fetch("/api/send-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company_id: company.company_id, email: company.contact_email }),
        });
        
        if (!res.ok) {
          const data = await res.json();
          toast({ title: "Failed to resend invite", description: data.error || "Unknown error", variant: "destructive" });
        } else {
          toast({ title: "Invite resent successfully" });
        }
      } catch (err) {
        toast({ title: "Connection error", description: "Failed to reach invitation API", variant: "destructive" });
      }
      setLoadingAction(null);
    });
  };

  const handleResetPassword = async (company: Company) => {
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    
    startTransition(async () => {
      setLoadingAction(`reset-${company.company_id}`);
      const res = await resetClientPasswordAction(company.company_id, newPassword);
      if (res.error) {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
      } else {
        toast({ 
          title: "Password reset successful", 
          description: `New password for ${company.display_name} is now active.` 
        });
      }
      setLoadingAction(null);
      setConfirmModal({ type: 'reset', company: null });
      setNewPassword("");
    });
  };

  const handleDelete = async (company: Company) => {
    if (deleteConfirm !== "DELETE") return;
    
    startTransition(async () => {
      setLoadingAction(`delete-${company.company_id}`);
      const res = await deleteClientAction(company.company_id);
      if (res.error) {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Client deleted successfully" });
      }
      setLoadingAction(null);
      setConfirmModal({ type: 'delete', company: null });
      setDeleteConfirm("");
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" strokeWidth={1.5} />
          <Input
            placeholder="Search by company or URL"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-[var(--border)] bg-surface px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="stale">Stale</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="px-6 py-3 font-medium">Company ID</th>
              <th className="px-6 py-3 font-medium">Display Name</th>
              <th className="px-6 py-3 font-medium">Site URL</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Events</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--muted)]">
                  No clients found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.company_id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors"
                  onClick={() => router.push(`/admin/clients/${c.company_id}`)}
                >
                  <td className="px-6 py-4 font-mono text-sm">{c.company_id}</td>
                  <td className="px-6 py-4 text-sm font-medium">{c.display_name}</td>
                  <td className="px-6 py-4 text-sm text-[var(--muted)]">
                    {(c.firstSiteUrl || c.site_url || "N/A")}
                    {(c.siteCount ?? 0) > 1 && (
                      <span className="ml-1 text-[var(--info)] font-semibold">+{(c.siteCount ?? 1) - 1} more</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      if (c.status === "suspended") return <StatusDot status="suspended" />;
                      if (c.status === "invited") return <StatusDot status="invited" />;
                      if (c.status === "pending") return <StatusDot status="pending" />;
                      
                      const lastSeen = c.last_seen_at ? new Date(c.last_seen_at).getTime() : 0;
                      const now = Date.now();
                      const diffHours = (now - lastSeen) / (1000 * 60 * 60);

                      if (diffHours < 24) return <StatusDot status="onboarded" />;
                      return <StatusDot status="stale" />;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-sm">
                    {c.total_events?.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/admin/clients/${c.company_id}`} prefetch={true}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={!!loadingAction}>
                            {loadingAction?.startsWith('invite-') && loadingAction.includes(c.company_id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {c.status === 'invited' && (
                            <DropdownMenuItem onClick={() => handleResendInvite(c)}>
                              <Mail className="mr-2 h-4 w-4" /> Resend Invite
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setConfirmModal({ type: 'reset', company: c })}>
                            <Key className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConfirmModal({ type: 'suspend', company: c })}>
                            {c.status === 'suspended' ? (
                              <><Unlock className="mr-2 h-4 w-4" /> Unsuspend</>
                            ) : (
                              <><Lock className="mr-2 h-4 w-4" /> Suspend</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-[var(--critical)]"
                            onClick={() => setConfirmModal({ type: 'delete', company: c })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modals */}
      <Dialog 
        open={!!confirmModal.company} 
        onOpenChange={(open) => !open && setConfirmModal({ ...confirmModal, company: null })}
      >
        <DialogContent className="sm:max-w-md">
          {confirmModal.type === 'suspend' && confirmModal.company && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirmModal.company.status === 'suspended' ? 'Unsuspend' : 'Suspend'} client?
                </DialogTitle>
                <DialogDescription>
                  {confirmModal.company.status === 'suspended' 
                    ? `This will restore dashboard access for ${confirmModal.company.display_name}.`
                    : `This will block dashboard access for ${confirmModal.company.display_name}. Security data collection will continue.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-end">
                <Button variant="ghost" onClick={() => setConfirmModal({ ...confirmModal, company: null })}>Cancel</Button>
                <Button 
                  variant={confirmModal.company.status === 'suspended' ? 'default' : 'destructive'}
                  onClick={() => handleSuspend(confirmModal.company!)}
                  disabled={!!loadingAction}
                >
                  {loadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {confirmModal.company.status === 'suspended' ? 'Unsuspend Account' : 'Suspend Account'}
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmModal.type === 'reset' && confirmModal.company && (
            <>
              <DialogHeader>
                <DialogTitle>Reset Client Password</DialogTitle>
                <DialogDescription>
                  Generate a new password for <strong>{confirmModal.company.display_name}</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">New Password</label>
                  <div className="relative">
                    <Input 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new strong password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(newPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmModal({ ...confirmModal, company: null })}>Cancel</Button>
                <Button 
                  onClick={() => handleResetPassword(confirmModal.company!)}
                  disabled={!newPassword || newPassword.length < 8 || !!loadingAction}
                >
                  {loadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update Password
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmModal.type === 'delete' && confirmModal.company && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[var(--critical)] flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Delete Client Account?
                </DialogTitle>
                <DialogDescription className="space-y-2">
                  <p>This will <strong>permanently delete</strong> the client account and company profile for <strong>{confirmModal.company.display_name}</strong>.</p>
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                    Security event history will be preserved, but the client will no longer be able to log in.
                  </p>
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                <p className="text-sm">Type <span className="font-bold">DELETE</span> to confirm:</p>
                <Input 
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="border-red-200 focus-visible:ring-red-500"
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmModal({ ...confirmModal, company: null })}>Cancel</Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleDelete(confirmModal.company!)}
                  disabled={deleteConfirm !== "DELETE" || !!loadingAction}
                >
                  {loadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Permanently Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}