"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncEngine } from "@/lib/sync/sync-engine";
import { ACTIVE_USER_KEY, clearLocalData } from "@/lib/db/dexie";

/**
 * Boots the background sync engine for the lifetime of the authenticated app,
 * and enforces per-user isolation of client-side state.
 *
 * IndexedDB and the React Query cache are per-browser, not per-user. On a shared
 * computer, if a *different* user signs in than the one who owns the local
 * cache, we wipe both so User B can never see User A's cached documents (a
 * privacy/tenant-isolation guarantee that complements the server-side RBAC).
 */
export function SyncProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const previous = localStorage.getItem(ACTIVE_USER_KEY);
    if (previous && previous !== userId) {
      void clearLocalData();
      queryClient.clear();
    }
    localStorage.setItem(ACTIVE_USER_KEY, userId);
  }, [userId, queryClient]);

  useEffect(() => {
    syncEngine.start();
    return () => syncEngine.stop();
  }, []);

  return <>{children}</>;
}
