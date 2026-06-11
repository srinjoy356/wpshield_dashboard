"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { sendResetLink } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email) {
      setError("Please enter your email.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("email", email);
      const result = await sendResetLink(formData);

      if (!result.success) {
        setError(result.error || "Failed to send reset link");
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
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-surface p-8 shadow-sm relative">
        <Link href="/login" className="absolute top-8 left-8 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex justify-center mb-6 mt-4">
          <Image
            src="/logos/cybernara-black.png"
            alt="Cybernara"
            width={160}
            height={40}
            className="h-10 w-auto"
          />
        </div>
        <h1 className="text-center text-2xl font-semibold text-[var(--foreground)]">
          Reset Password
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--muted)]">
          Enter your email to receive a password reset link
        </p>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <div className="mt-8 space-y-6">
            <Alert className="border-green-200 bg-green-50 text-green-700">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                If an account exists with that email, a password reset link has been sent. Please check your inbox.
              </AlertDescription>
            </Alert>
            <Link href="/login" className="block w-full">
              <Button variant="outline" className="w-full">
                Return to Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-surface border-[var(--border)] focus:ring-2 focus:ring-[var(--foreground)]"
                disabled={loading}
                required
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
                  Sending link...
                </>
              ) : (
                "Send Reset Link"
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
