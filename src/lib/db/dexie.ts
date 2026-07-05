import Dexie, { type EntityTable } from "dexie";
import type { SyncDoc } from "@/domain/crdt/types";

/**
 * IndexedDB (via Dexie) is the client's PRIMARY source of truth.
 *
 * Documents are read from and written to IndexedDB synchronously w.r.t. the UI;
 * the network is never on the critical path of opening/editing/closing a doc.
 * The sync engine reconciles this local state with the server in the background.
 *
 * Two stores:
 *  - `docs`  : the local materialized document (current CRDT state + the last
 *              state we know the server has, so we can compute minimal deltas).
 *  - `queue` : the durable outbox of operations waiting to be pushed. Survives
 *              reloads and offline periods, so edits are never lost.
 */

export interface LocalDoc {
  id: string;
  title: string;
  /** Current local truth. */
  syncDoc: SyncDoc;
  /** Last state we know the server holds (base for computing deltas). */
  serverBaseDoc: SyncDoc;
  /** Last server version integer we've observed. */
  serverVersion: number;
  updatedAt: number;
  /** Whether we hold unsynced local edits (for the UI indicator). */
  dirty: boolean;
}

export type QueueStatus = "pending" | "inflight" | "error";

export interface QueuedOp {
  opId: string;
  documentId: string;
  deviceId: string;
  lamport: number;
  baseVersion: number;
  /** Block delta (StampedBlock[]) serialized as-is. */
  payload: SyncDoc["blocks"][string][];
  timestamp: number;
  attempts: number;
  status: QueueStatus;
  /** Earliest time (ms epoch) this op may be retried (exponential backoff). */
  nextAttemptAt: number;
  lastError?: string;
}

export class SyncwriteDB extends Dexie {
  docs!: EntityTable<LocalDoc, "id">;
  queue!: EntityTable<QueuedOp, "opId">;

  constructor() {
    super("syncwrite");
    this.version(1).stores({
      docs: "id, updatedAt, dirty",
      queue: "opId, documentId, status, nextAttemptAt",
    });
  }
}

let dbInstance: SyncwriteDB | null = null;

/** Lazily create the DB. Requires an IndexedDB implementation (browser, or a
 * polyfill such as fake-indexeddb in tests). */
export function getDb(): SyncwriteDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment");
  }
  dbInstance ??= new SyncwriteDB();
  return dbInstance;
}

/** localStorage key tracking which user the local (IndexedDB) cache belongs to. */
export const ACTIVE_USER_KEY = "syncwrite:active-user";

/**
 * Wipe all locally-cached document state (bodies + sync outbox).
 *
 * Called on sign-out and when a *different* user signs in on the same browser,
 * so one user can never see another's cached documents from local-first storage.
 */
export async function clearLocalData(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = getDb();
  await db.transaction("rw", db.docs, db.queue, async () => {
    await db.docs.clear();
    await db.queue.clear();
  });
}
