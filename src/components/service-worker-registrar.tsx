"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) that enables offline reloads.
 *
 * Only in production: a caching SW in dev fights Turbopack's HMR and serves
 * stale bundles, so we skip it there. Renders nothing.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("[sw] registration failed:", err));

    // Wait for load so SW registration never competes with initial page work.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
