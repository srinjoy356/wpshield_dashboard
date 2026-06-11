"use client";

import ClientLayout from "@/components/layouts/ClientLayout";
import { UserProvider } from "@/lib/auth/use-user";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ClientLayout>{children}</ClientLayout>
    </UserProvider>
  );
}
