"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { changeClientPasswordAction } from "@/app/app/settings/actions";
import { Loader2, Eye, EyeOff } from "lucide-react";

export function ChangePasswordForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!currentPw) newErrors.current = "Current password is required";
    if (!newPw) {
      newErrors.new = "New password is required";
    } else if (newPw.length < 8) {
      newErrors.new = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(newPw)) {
      newErrors.new = "Must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(newPw)) {
      newErrors.new = "Must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(newPw)) {
      newErrors.new = "Must contain at least one number";
    } else if (!/[^A-Za-z0-9]/.test(newPw)) {
      newErrors.new = "Must contain at least one special character";
    }
    if (confirmPw !== newPw) newErrors.confirm = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    startTransition(async () => {
      const result = await changeClientPasswordAction({ currentPw, newPw });
      
      if (result.error) {
        setErrors({ current: result.error });
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Password changed successfully. Other sessions have been logged out.",
        });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        setErrors({});
      }
    });
  };

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">Current Password</label>
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="bg-surface focus:ring-2 focus:ring-[var(--foreground)] pr-10"
              placeholder="••••••••"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.current && <p className="mt-1 text-xs text-red-500">{errors.current}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">New Password</label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="bg-surface focus:ring-2 focus:ring-[var(--foreground)] pr-10"
              placeholder="At least 8 characters"
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.new && <p className="mt-1 text-xs text-red-500">{errors.new}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--muted-foreground)]">Confirm New Password</label>
          <Input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            className="bg-surface focus:ring-2 focus:ring-[var(--foreground)]"
            placeholder="Repeat new password"
            disabled={isPending}
          />
          {errors.confirm && <p className="mt-1 text-xs text-red-500">{errors.confirm}</p>}
        </div>
      </div>

      <div className="pt-4">
        <Button onClick={handleSave} className="w-full sm:w-auto px-8" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Password
        </Button>
      </div>
    </div>
  );
}
