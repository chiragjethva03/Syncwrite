import { describe, expect, it } from "vitest";
import {
  applyDelta,
  diffDelta,
  mergeDocs,
  winner,
} from "@/domain/crdt/merge";
import type { StampedBlock, SyncDoc } from "@/domain/crdt/types";

/**
 * These tests PROVE the properties that make conflict resolution deterministic:
 *   - a total order over concurrent writes (winner)
 *   - commutativity, associativity, idempotency of the merge (⊔)
 *   - convergence: replicas that see the same writes in any order agree
 *   - no data loss for concurrent edits to *different* blocks
 * If these hold, every device provably converges to the same document.
 */

function block(
  id: string,
  text: string,
  lamport: number,
  deviceId: string,
  deleted = false,
): StampedBlock {
  return {
    id,
    fracIndex: id, // use id as order key for test simplicity
    node: deleted
      ? null
      : { type: "paragraph", content: [{ type: "text", text }] },
    lamport,
    deviceId,
    deleted,
  };
}

function docOf(...blocks: StampedBlock[]): SyncDoc {
  const doc: SyncDoc = { blocks: {}, versionVector: {} };
  for (const b of blocks) {
    doc.blocks[b.id] = b;
    doc.versionVector[b.deviceId] = Math.max(
      doc.versionVector[b.deviceId] ?? 0,
      b.lamport,
    );
  }
  return doc;
}

describe("winner — deterministic total order", () => {
  it("prefers the higher Lamport clock", () => {
    const a = block("1", "a", 5, "deviceA");
    const b = block("1", "b", 7, "deviceB");
    expect(winner(a, b)).toBe(b);
    expect(winner(b, a)).toBe(b); // symmetric
  });

  it("breaks Lamport ties by deviceId (stable across replicas)", () => {
    const a = block("1", "a", 5, "deviceA");
    const b = block("1", "b", 5, "deviceB");
    expect(winner(a, b)).toBe(b); // "deviceB" > "deviceA"
    expect(winner(b, a)).toBe(b);
  });
});

describe("mergeDocs — CRDT join properties", () => {
  const A = docOf(block("1", "hello", 1, "A"), block("2", "world", 1, "A"));
  const B = docOf(block("1", "HELLO", 2, "B"), block("3", "extra", 1, "B"));

  it("is commutative: A ⊔ B == B ⊔ A", () => {
    expect(mergeDocs(A, B)).toEqual(mergeDocs(B, A));
  });

  it("is idempotent: A ⊔ A == A", () => {
    expect(mergeDocs(A, A)).toEqual(A);
  });

  it("is associative: (A ⊔ B) ⊔ C == A ⊔ (B ⊔ C)", () => {
    const C = docOf(block("2", "WORLD", 3, "C"));
    const left = mergeDocs(mergeDocs(A, B), C);
    const right = mergeDocs(A, mergeDocs(B, C));
    expect(left).toEqual(right);
  });

  it("keeps concurrent edits to DIFFERENT blocks (no data loss)", () => {
    const merged = mergeDocs(A, B);
    // block 2 (only in A) and block 3 (only in B) both survive.
    expect(merged.blocks["2"].node).not.toBeNull();
    expect(merged.blocks["3"].node).not.toBeNull();
    // block 1 concurrently edited -> higher lamport (B) wins deterministically.
    expect(merged.blocks["1"].deviceId).toBe("B");
  });
});

describe("convergence — order independence", () => {
  it("three replicas applying the same deltas in different orders converge", () => {
    const base = docOf(block("1", "seed", 1, "root"));
    const d1 = [block("1", "edit-from-A", 2, "A")];
    const d2 = [block("2", "insert-from-B", 2, "B")];
    const d3 = [block("1", "edit-from-C", 3, "C")];

    const r1 = applyDelta(applyDelta(applyDelta(base, d1).doc, d2).doc, d3).doc;
    const r2 = applyDelta(applyDelta(applyDelta(base, d3).doc, d1).doc, d2).doc;
    const r3 = applyDelta(applyDelta(applyDelta(base, d2).doc, d3).doc, d1).doc;

    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
    // Highest lamport for block 1 is C's edit -> that wins everywhere.
    expect(r1.blocks["1"].node).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "edit-from-C" }],
    });
  });
});

describe("delete semantics", () => {
  it("a concurrent edit with a higher clock resurrects over a delete", () => {
    const doc = docOf(block("1", "text", 1, "A"));
    const withDelete = applyDelta(doc, [block("1", "", 2, "A", true)]).doc;
    const withEdit = applyDelta(withDelete, [
      block("1", "back again", 3, "B"),
    ]).doc;
    expect(withEdit.blocks["1"].deleted).toBe(false);
    expect(withEdit.blocks["1"].node).not.toBeNull();
  });

  it("a delete with the higher clock wins", () => {
    const doc = docOf(block("1", "text", 2, "A"));
    const merged = applyDelta(doc, [block("1", "", 3, "B", true)]).doc;
    expect(merged.blocks["1"].deleted).toBe(true);
  });
});

describe("diffDelta — minimal transmission", () => {
  it("emits only blocks that changed since base", () => {
    const base = docOf(block("1", "a", 1, "A"), block("2", "b", 1, "A"));
    const next = applyDelta(base, [block("2", "b2", 2, "A")]).doc;
    const delta = diffDelta(base, next);
    expect(delta).toHaveLength(1);
    expect(delta[0].id).toBe("2");
  });

  it("applying a diff reproduces the source state (round-trip)", () => {
    const base = docOf(block("1", "a", 1, "A"));
    const next = applyDelta(base, [
      block("1", "a2", 2, "A"),
      block("2", "new", 2, "A"),
    ]).doc;
    const delta = diffDelta(base, next);
    expect(applyDelta(base, delta).doc).toEqual(next);
  });
});
