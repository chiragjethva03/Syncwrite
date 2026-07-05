import { getDb, type QueuedOp } from "@/lib/db/dexie";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { integrateRemote, getLocalDoc } from "./local-store";
import type { BlockDelta } from "@/domain/crdt/types";

/**
 * Background synchronization engine.
 *
 * Responsibilities:
 *  - detect online/offline transitions and react (flush on reconnect),
 *  - drain the durable operation outbox with EXPONENTIAL BACKOFF + jitter,
 *  - distinguish retryable failures (network / 5xx / 429) from permanent ones
 *    (4xx validation/authorization) so we never spin forever on a doomed op,
 *  - pull remote changes for open documents so collaborators converge,
 *  - broadcast a status snapshot the UI subscribes to for indicators.
 *
 * It runs a single-flight loop: one op in flight at a time, oldest first, which
 * keeps server ordering sane. Correctness never depends on ordering though —
 * the CRDT merge converges regardless — this is purely to be a good citizen.
 */

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
}

type Listener = (status: SyncStatus) => void;

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const LOOP_INTERVAL_MS = 2_500;
const PULL_INTERVAL_MS = 5_000;

function backoffFor(attempts: number): number {
  const exp = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
  const jitter = Math.random() * 0.3 * exp; // avoid thundering herd
  return exp + jitter;
}

/** 4xx (except 429) means the op can never succeed as-is — stop retrying. */
function isPermanent(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  );
}

class SyncEngine {
  private listeners = new Set<Listener>();
  private activeDocs = new Set<string>();
  private lastPull = new Map<string, number>();
  private loop: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private started = false;

  private status: SyncStatus = {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    syncing: false,
    pending: 0,
    lastSyncedAt: null,
    error: null,
  };

  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    this.loop = setInterval(() => void this.tick(), LOOP_INTERVAL_MS);
    void this.refreshPending();
    void this.tick();
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /** Mark a document as open so we pull remote changes for it. */
  registerDoc(id: string) {
    this.activeDocs.add(id);
    void this.tick();
  }

  unregisterDoc(id: string) {
    this.activeDocs.delete(id);
    this.lastPull.delete(id);
  }

  /** Request an immediate flush (called right after enqueuing an edit). */
  kick() {
    void this.tick();
  }

  /** Force an immediate pull for a document (e.g. right after a restore). */
  async pullNow(id: string) {
    this.lastPull.delete(id);
    await this.tick();
  }

  private handleOnline = () => {
    this.patch({ online: true, error: null });
    void this.tick();
  };

  private handleOffline = () => {
    this.patch({ online: false });
  };

  private patch(partial: Partial<SyncStatus>) {
    this.status = { ...this.status, ...partial };
    for (const l of this.listeners) l(this.status);
  }

  private async refreshPending() {
    const pending = await getDb().queue.count();
    this.patch({ pending });
  }

  private async tick() {
    if (this.running) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.patch({ online: false });
      return;
    }
    this.running = true;
    this.patch({ syncing: true, online: true });
    try {
      await this.drainQueue();
      await this.pullActiveDocs();
      this.patch({ lastSyncedAt: Date.now(), error: null });
    } catch (error) {
      this.patch({ error: (error as Error).message });
    } finally {
      await this.refreshPending();
      this.patch({ syncing: false });
      this.running = false;
    }
  }

  private async drainQueue() {
    const db = getDb();
    for (;;) {
      const now = Date.now();
      // Oldest eligible op first (respecting backoff).
      const op = await db.queue
        .where("nextAttemptAt")
        .belowOrEqual(now)
        .filter((o) => o.status !== "inflight")
        .first();
      if (!op) break;

      await db.queue.update(op.opId, { status: "inflight" });
      try {
        await this.pushOne(op);
        await db.queue.delete(op.opId);
      } catch (error) {
        if (isPermanent(error)) {
          // Doomed op — drop it so it can't block the queue, surface the error.
          await db.queue.delete(op.opId);
          this.patch({ error: (error as ApiClientError).message });
          continue;
        }
        const attempts = op.attempts + 1;
        await db.queue.update(op.opId, {
          status: "error",
          attempts,
          nextAttemptAt: Date.now() + backoffFor(attempts),
          lastError: (error as Error).message,
        });
        // Stop draining this pass; the loop will retry after the backoff.
        break;
      }
    }
  }

  private async pushOne(op: QueuedOp) {
    const local = await getLocalDoc(op.documentId);
    const sinceVersion = local?.serverVersion ?? 0;
    const result = await apiFetch<{
      serverVersion: number;
      delta: BlockDelta;
      acked: string[];
    }>(`/api/documents/${op.documentId}/sync`, {
      method: "POST",
      body: JSON.stringify({
        sinceVersion,
        operations: [
          {
            opId: op.opId,
            deviceId: op.deviceId,
            lamport: op.lamport,
            baseVersion: op.baseVersion,
            timestamp: op.timestamp,
            payload: op.payload,
          },
        ],
      }),
    });
    await integrateRemote(op.documentId, result.delta, result.serverVersion);
  }

  private async pullActiveDocs() {
    const now = Date.now();
    for (const id of this.activeDocs) {
      if (now - (this.lastPull.get(id) ?? 0) < PULL_INTERVAL_MS) continue;
      this.lastPull.set(id, now);
      const local = await getLocalDoc(id);
      if (!local) continue;
      try {
        const result = await apiFetch<{
          serverVersion: number;
          delta: BlockDelta;
        }>(`/api/documents/${id}/sync?since=${local.serverVersion}`);
        await integrateRemote(id, result.delta, result.serverVersion);
      } catch (error) {
        if (isPermanent(error)) this.lastPull.set(id, now + PULL_INTERVAL_MS);
      }
    }
  }
}

/** App-wide singleton. */
export const syncEngine = new SyncEngine();
