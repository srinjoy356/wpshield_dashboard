"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { toggleAutoUpdateThemes } from "@/app/app/inventory/actions";

export function AutoUpdateThemeToggle({
  companyId,
  initialValue,
}: {
  companyId: string;
  initialValue: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(initialValue);
  const { toast } = useToast();

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEnabled(checked);
    setLoading(true);
    try {
      await toggleAutoUpdateThemes(companyId, checked);
      toast({
        title: checked ? "Auto-update themes enabled" : "Auto-update themes disabled",
      });
    } catch (err) {
      setEnabled(!checked);
      toast({
        title: "Error",
        description: "Could not update setting",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="auto-update-themes"
        checked={enabled}
        onChange={handleToggle}
        disabled={loading}
        className="h-4 w-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
      />
      <label htmlFor="auto-update-themes" className="text-sm font-medium text-[var(--foreground)]">
        Auto-Update Themes
      </label>
    </div>
  );
}
