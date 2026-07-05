import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CloudOff,
  GitBranch,
  History,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppFooter } from "@/components/app-footer";

const features = [
  { icon: CloudOff, title: "Local-first & offline", desc: "Open, edit, and close documents with zero network on the critical path. IndexedDB is the source of truth." },
  { icon: GitBranch, title: "Deterministic merge", desc: "A block-level CRDT with Lamport clocks converges every device to the same document — no lost edits." },
  { icon: Zap, title: "Background sync", desc: "A durable operation queue with exponential-backoff retry pushes changes the moment you reconnect." },
  { icon: History, title: "Version time-travel", desc: "Capture snapshots and restore any point in history non-destructively." },
  { icon: Sparkles, title: "AI assistance", desc: "Summarize, fix grammar, improve writing, generate titles, and continue drafts with AI." },
  { icon: ShieldCheck, title: "Secure by design", desc: "Zod-validated, size-bounded sync payloads, per-tenant authorization, and role-based access." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <span className="text-lg font-semibold">{siteConfig.name}</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Next.js 16 · Local-first · CRDT sync
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            {siteConfig.tagline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            {siteConfig.description}
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Start writing <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
