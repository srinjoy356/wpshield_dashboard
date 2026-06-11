"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { login } from "./actions";
import Link from "next/link";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unauthorizedError = searchParams.get("error") === "unauthorized";
  const suspendedError = searchParams.get("error") === "suspended";
  const successMessage = searchParams.get("message");

  useEffect(() => {
    if (unauthorizedError) {
      setError("You don't have permission to access that page.");
    } else if (suspendedError) {
      setError("Your account has been suspended. Please contact your administrator.");
    }
  }, [unauthorizedError, suspendedError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);

      const result = await login(formData);

      if (!result.success) {
        setError(result.error || "Login failed");
        setLoading(false);
        return;
      }

      if (result.role === "admin") {
        router.push("/admin");
      } else if (result.role === "client") {
        router.push("/app");
      } else {
        setError("Invalid account role.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Main login card */}
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
          Cybernara WPShield
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--muted)]">
          Sign in to your security dashboard
        </p>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && !error && (
          <Alert className="mt-6 border-green-200 bg-green-50 text-green-700">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
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
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--foreground)]">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
          <div className="flex flex-col space-y-2 mt-4 text-center">
            <Link href="/forgot-password" className="text-sm text-[var(--muted)] cursor-pointer hover:text-[var(--foreground)]">
              Forgot password?
            </Link>
            <div className="text-sm text-[var(--muted)]">
              Don't have an account?{" "}
              <Link href="/sign-up" className="text-[var(--primary)] hover:underline font-medium">
                Sign up
              </Link>
            </div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full py-4 text-center">
        <p className="text-xs text-[var(--muted)]">© Cybernara - WPShield 2026</p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
