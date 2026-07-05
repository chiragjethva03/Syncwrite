"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import {
  ArrowRight,
  CloudOff,
  GitBranch,
  History,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { AppFooter } from "@/components/app-footer";

const features = [
  { icon: CloudOff, title: "Local-first & offline", desc: "Open, edit, and close documents with zero network on the critical path. IndexedDB is the source of truth." },
  { icon: GitBranch, title: "Deterministic merge", desc: "A block-level CRDT with Lamport clocks converges every device to the same document, with no lost edits." },
  { icon: Zap, title: "Background sync", desc: "A durable operation queue with exponential-backoff retry pushes changes the moment you reconnect." },
  { icon: History, title: "Version time-travel", desc: "Capture snapshots and restore any point in history non-destructively." },
  { icon: Sparkles, title: "AI assistance", desc: "Summarize, fix grammar, improve writing, generate titles, and continue drafts with AI." },
  { icon: ShieldCheck, title: "Secure by design", desc: "Zod-validated, size-bounded sync payloads, per-tenant authorization, and role-based access." },
];

// Slow, staggered entrance so the hero eases in as the page opens.
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

export function LandingContent({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1">
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-4xl px-4 py-20 text-center"
        >
          <motion.p
            variants={rise}
            className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground"
          >
            <Sparkles className="size-3.5 text-primary" /> Next.js 16 · Local-first · CRDT sync
          </motion.p>
          <motion.h1
            variants={rise}
            className="text-balance text-4xl font-bold tracking-tight sm:text-6xl"
          >
            {siteConfig.tagline}
          </motion.h1>
          <motion.p
            variants={rise}
            className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground"
          >
            {siteConfig.description}
          </motion.p>
          <motion.div variants={rise} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Go to dashboard <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/register">
                    Start writing <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </motion.div>
        </motion.section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: "easeOut" }}
              className="rounded-xl border bg-card p-5"
            >
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
