"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { resetPassword } from "./actions";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("password", password);
      formData.append("confirmPassword", confirmPassword);

      const result = await resetPassword(formData);

      if (!result.success) {
        setError(result.error || "Failed to reset password.");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-surface p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <Image
            src="/logos/cybernara-black.png"
            alt="Cybernara"
            width={160}
            height={40}
            className="h-10 w-auto"
          />
        </div>
        <h1 className="text-center text-2xl font-semibold text-[var(--foreground)]">
          Update Password
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--muted)]">
          Enter a new, strong password
        </p>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <div className="mt-8 space-y-6 text-center">
            <Alert className="border-green-200 bg-green-50 text-green-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>Your password has been successfully reset!</AlertDescription>
            </Alert>
            <p className="text-sm text-[var(--muted)]">
              You can now log in using your new password.
            </p>
            <Button onClick={() => router.push("/login")} className="w-full bg-[var(--primary)] text-[var(--primary-foreground)]">
              Go to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                New Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-surface border-[var(--border)] focus:ring-2 focus:ring-[var(--foreground)]"
                disabled={loading}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Confirm Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-surface border-[var(--border)] focus:ring-2 focus:ring-[var(--foreground)]"
                disabled={loading}
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        )}
      </div>

      <footer className="fixed bottom-0 w-full py-4 text-center">
        <p className="text-xs text-[var(--muted)]">© Cybernara - WPShield 2026</p>
      </footer>
    </div>
  );
}
