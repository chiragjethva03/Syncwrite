"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export function NotFoundContent() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12 text-center"
    >
      <div>
        {/* Oversized brand-gradient 404 — the focal point of the page. */}
        <motion.p
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
          className="select-none bg-gradient-to-br from-[#8b6cff] to-[#5b8def] bg-clip-text text-[7rem] font-extrabold leading-none tracking-tighter text-transparent sm:text-[11rem] lg:text-[13rem]"
        >
          404
        </motion.p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
          Your documents are safe and synced.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </motion.main>
  );
}
