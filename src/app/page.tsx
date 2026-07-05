import { getCurrentUser } from "@/server/auth/session";
import { LandingContent } from "@/features/landing/landing-content";

export default async function LandingPage() {
  // The landing page is viewable whether or not you're signed in; the CTAs adapt.
  const user = await getCurrentUser();
  return <LandingContent isAuthenticated={Boolean(user)} />;
}
