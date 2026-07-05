"use client";

import { useEffect } from "react";
import { syncEngine } from "@/lib/sync/sync-engine";

/**
 * Boots the background sync engine for the lifetime of the authenticated app.
 * Mounted once near the root of the (app) segment.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);
  return <>{children}</>;
}
