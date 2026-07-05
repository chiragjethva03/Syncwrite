# Conflict Resolution — Design & Merge Algorithm

This document explains how Syncwrite resolves concurrent edits **deterministically
and without data loss**, and why we chose this design over the alternatives.

## The problem

Multiple devices edit the same document, some of them offline. When they sync,
their edits must be merged so that:

1. **No edit is silently overwritten** ("last write wins on the whole document"
   is unacceptable — it destroys offline work).
2. Every replica **converges** to the exact same document, regardless of the
   order in which operations arrive.
3. The result is **deterministic** — the same set of edits always produces the
   same document on every device and on the server.

## Approaches considered

| Approach | Convergence | Complexity | Verdict |
| --- | --- | --- | --- |
| **Whole-document Last-Writer-Wins** | ✗ loses concurrent edits | trivial | Rejected — the exact failure the assignment warns against |
| **Operational Transform (OT)** | ✓ (needs a central server + transform functions) | very high; hard to get correct | Rejected — server-authoritative, brittle transforms |
| **Character-level CRDT (RGA/Yjs)** | ✓ | high; character-granular metadata overhead | Overkill; hides the algorithm behind a library |
| **Block-level state CRDT (chosen)** | ✓ | moderate; fully explainable & testable | **Chosen** |

We implemented a **block-level state-based CRDT**: an *LWW-Element-Map* of
document blocks with fractional-index ordering. It gives true convergence, is
small enough to implement and **prove correct with tests**, and its granularity
(a paragraph/heading/list/table) matches how people actually co-edit prose.

## The model

A document is a map of **stamped blocks** (`src/domain/crdt/types.ts`):

```ts
interface StampedBlock {
  id: string;          // stable identity, assigned by the editor (BlockId extension)
  fracIndex: string;   // fractional index → convergent ordering
  node: ProseMirrorNode | null;  // block content (null when tombstoned)
  lamport: number;     // Lamport logical clock of the last write
  deviceId: string;    // origin device (deterministic tie-breaker)
  deleted: boolean;    // tombstone
}
```

Each block is an independent **Last-Writer-Wins register**. The whole document is
the map of these registers plus a **version vector** (`deviceId → max lamport`).

### 1. Deterministic total order (the heart of it)

Two concurrent writes to the *same* block are resolved by `winner()`
(`src/domain/crdt/merge.ts`):

```
winner(a, b):
  if a.lamport ≠ b.lamport → the higher lamport wins   # causality
  else if a.deviceId ≠ b.deviceId → higher deviceId wins  # stable tie-break
  else → identical write (idempotent)
```

- **Lamport clocks** capture causality: an edit made *after observing* another
  edit gets a higher clock and supersedes it.
- **deviceId** breaks ties for genuinely concurrent edits. It is arbitrary but
  **identical on every replica**, which is what makes the outcome deterministic.

Because this is a **total order**, every replica independently computes the same
winner for every block → all replicas converge to byte-identical documents.

### 2. Merge is a CRDT join (⊔)

`mergeDocs(a, b)` takes the union of block ids and, per id, keeps the `winner`.
The version vector becomes the element-wise max. This join is:

- **Commutative** — `a ⊔ b == b ⊔ a`
- **Associative** — `(a ⊔ b) ⊔ c == a ⊔ (b ⊔ c)`
- **Idempotent** — `a ⊔ a == a`

These three properties are exactly the definition of a state-based CRDT and are
what guarantee convergence under arbitrary message ordering, duplication, and
delay. **They are proven in `tests/domain/merge.test.ts`.**

### 3. No data loss

- Concurrent edits to **different** blocks → both survive (they're different map
  entries).
- Concurrent edits to the **same** block → the loser is not part of the current
  projection, but it is never destroyed: the full op is retained in the durable
  operation log and in version snapshots.
- **Delete vs. edit** is resolved by the same clock rule: a delete tombstone with
  a higher clock wins; a concurrent edit with a higher clock *resurrects* the
  block. Deterministic, and documented as an intentional "edits beat stale
  deletes" bias.

### 4. Ordering under concurrent inserts

Block order is a **fractional index** string (`src/domain/crdt/fractional-index.ts`),
not an array position. To insert between two blocks we mint a key that sorts
between their keys — so two devices inserting "at position 3" simultaneously get
distinct, convergent keys (ties broken by block id). No sibling renumbering, so
an insert only touches one block's metadata.

## What actually travels over the wire

We don't ship whole documents. On each edit the client computes a **delta** —
`diffDelta(base, next)` — the set of blocks whose stamp changed since the server's
last-known state. That delta is the operation payload. Sync cost is therefore
`O(edited blocks)`, not `O(document size)` (see [architecture](./architecture.md)
and [real-world notes](#handling-document-state-size-over-time)).

## Server integration & race conditions

The server (`src/server/services/sync.service.ts`) is itself a convergent replica.
It integrates each delta with the **same merge function**, then returns a delta so
the client converges too. Simultaneous pushes to one document are handled with
**optimistic concurrency**: a write only lands if the document's `serverVersion`
is unchanged since we read it; otherwise we re-read and re-merge. Retries are safe
because merge is idempotent. This resolves the "state synchronization race
condition" without long-held locks.

## Version restore (non-destructive)

Restoring a version does **not** overwrite. It re-stamps the target snapshot's
blocks with fresh, highest Lamport clocks so they deterministically win the merge
(and tombstones blocks added after the snapshot). The restore is just another
operation that propagates to all collaborators via sync, and a **new** version row
records the restore point — so history is never lost.

## Handling document-state size over time

- **Operation log growth**: the durable `Operation` table grows with edits. In
  production we'd compact it: periodically fold operations older than the newest
  snapshot into that snapshot and prune them (the snapshot becomes the new base).
  `buildDelta` already falls back to a full snapshot when the log has a gap, so
  pruning is safe.
- **Tombstone growth**: deleted blocks leave tombstones. These can be garbage
  collected once every active replica's version vector has observed the delete
  (standard CRDT tombstone GC). For the assignment we keep them (bounded by
  document size in practice).

## Limitations & future work

- Merge granularity is the **block**, not the character. Two people typing in the
  *same paragraph* concurrently resolve to one winner for that paragraph. A
  character-level CRDT (e.g. Yjs) would merge intra-paragraph edits; the block
  model is a deliberate complexity/clarity trade-off and the architecture could
  swap in a sequence CRDT per block without changing the sync engine.
- Live collaboration currently uses **short-interval pull**; the CRDT makes a
  WebSocket/SSE upgrade a drop-in (push the same deltas over a socket).
- Remote changes are applied to the editor when the caret is idle;
  caret-preserving live application is a future enhancement.
