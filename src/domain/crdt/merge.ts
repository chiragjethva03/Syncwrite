import type { BlockDelta, StampedBlock, SyncDoc } from "./types";

/**
 * The deterministic merge core.
 *
 * `winner(a, b)` defines a **total order** over two writes to the same block:
 *   1. Higher Lamport clock wins (captures causality: a later logical edit
 *      supersedes an earlier one it may have observed).
 *   2. Ties broken by deviceId string comparison (arbitrary but *stable* and
 *      identical on every replica → deterministic).
 *
 * This total order is what makes the whole system deterministic: given the same
 * set of block writes, every replica independently computes the same winner for
 * every block, so all replicas converge to byte-identical documents.
 */
export function winner(a: StampedBlock, b: StampedBlock): StampedBlock {
  if (a.lamport !== b.lamport) return a.lamport > b.lamport ? a : b;
  if (a.deviceId !== b.deviceId) return a.deviceId > b.deviceId ? a : b;
  // Same lamport + same device: identical write (idempotent). Prefer a
  // non-deleted state defensively, else `a`.
  if (a.deleted !== b.deleted) return a.deleted ? b : a;
  return a;
}

/** True when the two stamped blocks represent the same logical write. */
export function sameWrite(a: StampedBlock, b: StampedBlock): boolean {
  return (
    a.lamport === b.lamport &&
    a.deviceId === b.deviceId &&
    a.deleted === b.deleted
  );
}

export function emptyDoc(): SyncDoc {
  return { blocks: {}, versionVector: {} };
}

function bumpVector(
  vector: Record<string, number>,
  deviceId: string,
  lamport: number,
): void {
  const current = vector[deviceId] ?? 0;
  if (lamport > current) vector[deviceId] = lamport;
}

/**
 * Merge a single block write into a document, returning whether the doc changed.
 * Pure w.r.t. the incoming block; mutates a *copy*-safe target passed by caller.
 */
function mergeBlockInto(target: SyncDoc, incoming: StampedBlock): boolean {
  const existing = target.blocks[incoming.id];
  const win = existing ? winner(existing, incoming) : incoming;
  bumpVector(target.versionVector, incoming.deviceId, incoming.lamport);
  if (existing && sameWrite(existing, win) && win === existing) return false;
  if (existing === win) return false;
  target.blocks[incoming.id] = win;
  return true;
}

/**
 * Merge a block delta into a document. Returns a NEW document (immutable) plus a
 * `changed` flag. Commutative + idempotent: applying the same delta twice, or in
 * any order relative to other deltas, yields the same result.
 */
export function applyDelta(
  doc: SyncDoc,
  delta: BlockDelta,
): { doc: SyncDoc; changed: boolean } {
  const next: SyncDoc = {
    blocks: { ...doc.blocks },
    versionVector: { ...doc.versionVector },
  };
  let changed = false;
  for (const block of delta) {
    if (mergeBlockInto(next, block)) changed = true;
  }
  return { doc: next, changed };
}

/**
 * Full state merge: merge two whole documents. This is the CRDT join (⊔).
 * Commutative, associative, idempotent — proven in merge.test.ts.
 */
export function mergeDocs(a: SyncDoc, b: SyncDoc): SyncDoc {
  const next: SyncDoc = {
    blocks: { ...a.blocks },
    versionVector: { ...a.versionVector },
  };
  for (const id of Object.keys(b.blocks)) {
    mergeBlockInto(next, b.blocks[id]);
  }
  // versionVector is the element-wise max of both vectors.
  for (const [device, clock] of Object.entries(b.versionVector)) {
    bumpVector(next.versionVector, device, clock);
  }
  return next;
}

/**
 * Compute the delta of blocks in `next` that differ from `base` (the last state
 * we know the peer already has). This is what we actually transmit.
 */
export function diffDelta(base: SyncDoc, next: SyncDoc): BlockDelta {
  const delta: BlockDelta = [];
  for (const id of Object.keys(next.blocks)) {
    const b = base.blocks[id];
    const n = next.blocks[id];
    if (!b || !sameWrite(b, n)) delta.push(n);
  }
  return delta;
}

/** The next Lamport clock for a device given the document it observed. */
export function nextLamport(doc: SyncDoc): number {
  let max = 0;
  for (const clock of Object.values(doc.versionVector)) {
    if (clock > max) max = clock;
  }
  for (const block of Object.values(doc.blocks)) {
    if (block.lamport > max) max = block.lamport;
  }
  return max + 1;
}
