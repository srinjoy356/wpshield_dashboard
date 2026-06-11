import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { SignUpForm } from "./SignUpForm";

function SignUpContent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Main sign-up card */}
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
          Create an Account
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--muted)]">
          Get started with WPShield
        </p>

        <SignUpForm />

        <div className="mt-6 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 w-full py-4 text-center">
        <p className="text-xs text-[var(--muted)]">© Cybernara - WPShield 2026</p>
      </footer>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--muted)]" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
