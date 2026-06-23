"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { login } from "./actions";
import { Component as SignInCard } from "@/components/ui/sign-in-card-2";

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
    <SignInCard
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      isLoading={loading}
      onSubmit={handleLogin}
      error={error}
      successMessage={successMessage}
    />
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
