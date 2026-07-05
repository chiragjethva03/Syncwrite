import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LandingContent } from "@/features/landing/landing-content";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <LandingContent />;
}
