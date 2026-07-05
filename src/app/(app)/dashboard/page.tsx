import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <>
      <AppHeader user={{ name: user.name, email: user.email }} />
      <main className="flex-1">
        <DashboardView userId={user.id} />
      </main>
      <AppFooter />
    </>
  );
}
