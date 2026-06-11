"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UserProfile, Company } from "@/types";
import { updateClientProfileAction } from "@/app/app/settings/actions";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface SettingsFormProps {
  profile: UserProfile;
  company: Company | null;
}

export function SettingsForm({ profile, company }: SettingsFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [email, setEmail] = useState(company?.contact_email || profile.email || "");

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateClientProfileAction({ displayName, email });
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Settings saved successfully.",
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">Full Name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-surface focus:ring-2 focus:ring-[var(--foreground)]"
            placeholder="Your name"
            disabled={isPending}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">Email Address</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface focus:ring-2 focus:ring-[var(--foreground)]"
            placeholder="your@email.com"
            disabled={isPending}
          />
          <p className="mt-1 text-[10px] text-[var(--muted)]">This will update the company contact email.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">Role</label>
          <Input
            value={profile.role === 'admin' ? 'Administrator' : 'Client User'}
            className="bg-[var(--surface-subtle)] font-medium text-[var(--muted)]"
            disabled
          />
        </div>
        
        {company && (
          <>
            <div className="pt-4 border-t border-[var(--border)]">
              <h4 className="text-sm font-semibold mb-3">Company Context</h4>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">Company Name</label>
                <Input
                  value={company.display_name}
                  className="bg-[var(--surface-subtle)] text-[var(--muted)]"
                  disabled
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">Company ID</label>
              <Input
                value={company.company_id}
                className="bg-[var(--surface-subtle)] font-mono text-xs text-[var(--muted)]"
                disabled
              />
            </div>
          </>
        )}
      </div>

      <div className="pt-4">
        <Button onClick={handleSave} className="w-full sm:w-auto px-8" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
