/**
 * Core CRDT types for the collaborative document model.
 *
 * We model a document as an **LWW-Element-Map of blocks** (block-level CRDT):
 *
 *   - The document body (a TipTap/ProseMirror `doc`) is decomposed into an
 *     ordered list of top-level blocks (paragraph, heading, list, table, ...).
 *   - Every block has a stable `id` that survives edits (assigned by a TipTap
 *     extension client-side; see features/editor/extensions/block-id).
 *   - Each block is an independent Last-Writer-Wins register, stamped with a
 *     Lamport clock + deviceId. Concurrent edits to *different* blocks both
 *     survive (no data loss). Concurrent edits to the *same* block are resolved
 *     by a deterministic total order: higher `lamport`, tie-broken by `deviceId`.
 *   - Block ordering is a `fracIndex` (fractional index string) so concurrent
 *     inserts get a stable, convergent order without renumbering siblings.
 *
 * Because the merge is a pure function over two states that is commutative,
 * associative, and idempotent, all replicas provably converge regardless of the
 * order in which operations arrive — the definition of "deterministic conflict
 * resolution". See docs/conflict-resolution.md and merge.test.ts for proofs.
 */

/** A ProseMirror node (opaque to the CRDT; we only key on block identity). */
export type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: unknown[];
  text?: string;
};

/** A single stamped block — the CRDT's atomic unit (an LWW register). */
export interface StampedBlock {
  /** Stable identity of this block across edits. */
  id: string;
  /** Fractional index controlling order among siblings ("a0", "a0V", ...). */
  fracIndex: string;
  /** The ProseMirror node for this block (null when tombstoned). */
  node: ProseMirrorNode | null;
  /** Lamport logical clock of the last write to this block. */
  lamport: number;
  /** Origin device of the last write (tie-breaker for determinism). */
  deviceId: string;
  /** Soft-delete tombstone. Kept so deletes converge and history is preserved. */
  deleted: boolean;
}

/** The CRDT document state: a map of blocks keyed by id + a version vector. */
export interface SyncDoc {
  blocks: Record<string, StampedBlock>;
  /** deviceId -> highest lamport clock integrated from that device. */
  versionVector: Record<string, number>;
}

/**
 * A block-level delta: the set of blocks that changed since a base version.
 * This is the payload actually sent over the wire (not the whole document),
 * which keeps sync O(edited blocks) instead of O(document size).
 */
export type BlockDelta = StampedBlock[];

/** Client-generated operation envelope pushed to the sync engine. */
export interface DocumentOperation {
  /** Idempotency key — safe to retry, never double-applied. */
  opId: string;
  documentId: string;
  deviceId: string;
  /** Lamport clock at the time the op was produced. */
  lamport: number;
  /** Server version the client believed it was editing against. */
  baseVersion: number;
  /** The changed blocks. */
  payload: BlockDelta;
  /** Wall-clock timestamp (used only for display / audit, never for merge). */
  timestamp: number;
}
