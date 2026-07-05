"use client";

import { useSyncExternalStore } from "react";
import { syncEngine, type SyncStatus } from "@/lib/sync/sync-engine";

const SERVER_SNAPSHOT: SyncStatus = {
  online: true,
  syncing: false,
  pending: 0,
  lastSyncedAt: null,
  error: null,
};

/**
 * Subscribe a component to the sync engine's status via useSyncExternalStore —
 * the correct concurrent-safe way to read an external mutable store in React 19.
 */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => syncEngine.subscribe(cb),
    () => syncEngine.getStatus(),
    () => SERVER_SNAPSHOT,
  );
}
