import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { siteConfig } from "@/config/site";
import { AppFooter } from "@/components/app-footer";
import { BrandMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Already signed in? Skip the auth screens.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <BrandMark className="size-12" />
            <p className="mt-3 text-lg font-semibold tracking-tight">{siteConfig.name}</p>
            <p className="text-sm text-muted-foreground">{siteConfig.tagline}</p>
          </div>
          {children}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
