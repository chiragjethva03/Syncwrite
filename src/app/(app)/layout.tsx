import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { SyncProvider } from "@/providers/sync-provider";
import { OfflineBanner } from "@/components/sync-status-indicator";

/**
 * Authenticated app shell. Enforces authentication server-side (the security
 * boundary) and boots the background sync engine for the session.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <SyncProvider userId={user.id}>
      <div className="flex min-h-screen flex-col">
        <OfflineBanner />
        {children}
      </div>
    </SyncProvider>
  );
}
