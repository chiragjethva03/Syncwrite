import { getDb, type LocalDoc } from "@/lib/db/dexie";
import { getDeviceId } from "@/lib/device";
import { reconcile, toProseMirror } from "@/domain/crdt/document";
import { diffDelta, mergeDocs, applyDelta } from "@/domain/crdt/merge";
import type { BlockDelta, ProseMirrorNode, SyncDoc } from "@/domain/crdt/types";

/**
 * LocalDocumentStore — the client's local-first data layer.
 *
 * All editor reads/writes go through here and hit IndexedDB, never the network.
 * Writes:
 *   1. reconcile the edited ProseMirror doc into stamped CRDT blocks,
 *   2. persist the new state,
 *   3. enqueue a *minimal* block delta (diff vs. what the server already has)
 *      as a durable operation for the sync engine to push.
 * This guarantees edits are captured locally + queued before any network I/O,
 * so nothing is lost if the tab closes or the connection drops.
 */

function emptyDoc(): SyncDoc {
  return { blocks: {}, versionVector: {} };
}

/** Ensure a local record exists; seed it from a server payload if provided. */
export async function ensureLocalDoc(
  id: string,
  seed?: { title: string; syncDoc: SyncDoc; serverVersion: number },
): Promise<LocalDoc> {
  const db = getDb();
  const existing = await db.docs.get(id);
  if (existing) {
    // If the server seed is newer, fold it in (without dropping local edits).
    if (seed && seed.serverVersion > existing.serverVersion) {
      const merged = mergeDocs(existing.syncDoc, seed.syncDoc);
      const updated: LocalDoc = {
        ...existing,
        title: seed.title,
        syncDoc: merged,
        serverBaseDoc: mergeDocs(existing.serverBaseDoc, seed.syncDoc),
        serverVersion: seed.serverVersion,
        updatedAt: Date.now(),
        dirty: diffDelta(seed.syncDoc, merged).length > 0,
      };
      await db.docs.put(updated);
      return updated;
    }
    return existing;
  }

  const record: LocalDoc = {
    id,
    title: seed?.title ?? "Untitled document",
    syncDoc: seed?.syncDoc ?? emptyDoc(),
    serverBaseDoc: seed?.syncDoc ?? emptyDoc(),
    serverVersion: seed?.serverVersion ?? 0,
    updatedAt: Date.now(),
    dirty: false,
  };
  await db.docs.put(record);
  return record;
}

export async function getLocalDoc(id: string): Promise<LocalDoc | undefined> {
  return getDb().docs.get(id);
}

/** Update the locally-cached title (kept in sync with server renames). */
export async function setLocalTitle(id: string, title: string): Promise<void> {
  await getDb().docs.update(id, { title });
}

/** Project the stored CRDT state to a ProseMirror doc for the editor. */
export async function getProseMirrorDoc(id: string): Promise<ProseMirrorNode | null> {
  const doc = await getLocalDoc(id);
  return doc ? toProseMirror(doc.syncDoc) : null;
}

/**
 * Apply an editor change. Returns the number of blocks queued for sync.
 * Debouncing/coalescing is the caller's concern (see the editor autosave hook);
 * every call here that produces a non-empty delta enqueues exactly one op.
 */
export async function applyEditorChange(
  id: string,
  proseMirrorDoc: ProseMirrorNode,
): Promise<number> {
  const db = getDb();
  const deviceId = getDeviceId();

  return db.transaction("rw", db.docs, db.queue, async () => {
    const current = await db.docs.get(id);
    if (!current) throw new Error(`Local doc ${id} not found`);

    const nextSyncDoc = reconcile(current.syncDoc, proseMirrorDoc, deviceId);
    // Delta = what changed vs. what the server already has.
    const delta: BlockDelta = diffDelta(current.serverBaseDoc, nextSyncDoc);

    await db.docs.put({
      ...current,
      syncDoc: nextSyncDoc,
      updatedAt: Date.now(),
      dirty: delta.length > 0,
    });

    if (delta.length === 0) return 0;

    // Enqueue a self-contained operation and advance the sync base so the next
    // edit diffs against this point (each op carries its own delta, so a failed
    // op still holds its blocks and will be retried without loss).
    await db.queue.add({
      opId: crypto.randomUUID(),
      documentId: id,
      deviceId,
      lamport: maxLamport(nextSyncDoc),
      baseVersion: current.serverVersion,
      payload: delta,
      timestamp: Date.now(),
      attempts: 0,
      status: "pending",
      nextAttemptAt: Date.now(),
    });

    await db.docs.update(id, {
      serverBaseDoc: nextSyncDoc,
    });

    return delta.length;
  });
}

/**
 * Fold a remote delta (from a push ack or a pull) into local state, keeping any
 * unsynced local edits intact.
 */
export async function integrateRemote(
  id: string,
  delta: BlockDelta,
  serverVersion: number,
): Promise<void> {
  if (delta.length === 0) {
    await getDb().docs.update(id, { serverVersion });
    return;
  }
  const db = getDb();
  await db.transaction("rw", db.docs, async () => {
    const current = await db.docs.get(id);
    if (!current) return;
    const syncDoc = applyDelta(current.syncDoc, delta).doc;
    const serverBaseDoc = applyDelta(current.serverBaseDoc, delta).doc;
    await db.docs.put({
      ...current,
      syncDoc,
      serverBaseDoc,
      serverVersion: Math.max(serverVersion, current.serverVersion),
      updatedAt: Date.now(),
      dirty: diffDelta(serverBaseDoc, syncDoc).length > 0,
    });
  });
}

function maxLamport(doc: SyncDoc): number {
  let max = 0;
  for (const b of Object.values(doc.blocks)) if (b.lamport > max) max = b.lamport;
  return max;
}
