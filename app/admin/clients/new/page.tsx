export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { getPendingCompanyById } from "@/lib/queries/companies";
import { OnboardForm } from "./OnboardForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function NewClientPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const fromId = params.from;
  let pendingData = null;

  if (fromId) {
    const supabase = createClient();
    pendingData = await getPendingCompanyById(supabase, fromId);

    if (!pendingData) {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Pending site not found</AlertTitle>
            <AlertDescription className="mt-2">
              The company ID "{fromId}" does not exist in our pending list.
              <div className="mt-4">
                <Link href="/admin/clients">
                  <Button variant="outline" size="sm">Return to Clients</Button>
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-surface p-8 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          {pendingData ? `Onboard new client: ${fromId}` : "Add new client"}
        </h2>
        <OnboardForm pending={pendingData} />
      </div>
    </div>
  );
}
