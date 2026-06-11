import { createAdminClient } from "@/lib/supabase/admin";
import { SetPasswordForm } from "./SetPasswordForm";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { token?: string };
}

export default async function SetPasswordPage({ searchParams }: PageProps) {
  // Extract token, ensuring we only get the query param part
  // searchParams in Next.js automatically excludes the # fragment
  const token = searchParams.token;

  if (!token) {
    return <ErrorState title="Missing Token" message="This link is invalid. Please contact your admin." />;
  }

  const adminClient = createAdminClient();
  
  // Validate token server-side
  const { data: invite, error } = await adminClient
    .from("client_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return <ErrorState title="Invalid Link" message="This link is invalid. Please contact your admin." />;
  }

  if (invite.used_at) {
    return (
      <ErrorState 
        title="Link Already Used" 
        message="Password already created." 
        icon={CheckCircle}
        action={
          <Link href="/login">
            <Button variant="outline">Go to Login</Button>
          </Link>
        }
      />
    );
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <ErrorState 
        title="Link Expired" 
        message="This link has expired (24hr limit). Contact your admin to resend." 
        icon={Clock}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="/logos/cybernara-black.png"
            alt="Cybernara"
            width={180}
            height={45}
            className="h-12 w-auto"
          />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-surface p-8 shadow-xl">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Welcome to WPShield</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Your security dashboard is ready. Set your password below to access your account.
            </p>
          </div>

          {/* Wrap form in a client-side handler if needed, but prop passing is fine */}
          <SetPasswordForm token={token} />
        </div>

        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          © Cybernara - WPShield 2026
        </p>
      </div>
    </div>
  );
}

function ErrorState({ 
  title, 
  message, 
  icon: Icon = AlertCircle,
  action
}: { 
  title: string; 
  message: string; 
  icon?: any;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8 opacity-50">
          <Image
            src="/logos/cybernara-black.png"
            alt="Cybernara"
            width={180}
            height={45}
            className="h-12 w-auto"
          />
        </div>
        <Alert variant="destructive" className="border-2">
          <Icon className="h-5 w-5" />
          <AlertTitle className="text-lg font-bold">{title}</AlertTitle>
          <AlertDescription className="mt-2 text-base">
            {message}
            {action && <div className="mt-4">{action}</div>}
          </AlertDescription>
        </Alert>
        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          © Cybernara - WPShield 2026
        </p>
      </div>
    </div>
  );
}
