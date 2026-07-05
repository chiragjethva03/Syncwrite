import { describe, expect, it } from "vitest";
import {
  reconcile,
  toProseMirror,
  fromProseMirror,
  extractText,
} from "@/domain/crdt/document";
import { diffDelta } from "@/domain/crdt/merge";
import type { ProseMirrorNode } from "@/domain/crdt/types";

function para(id: string, text: string): ProseMirrorNode {
  return {
    type: "paragraph",
    attrs: { blockId: id },
    content: [{ type: "text", text }],
  };
}
function doc(...blocks: ProseMirrorNode[]): ProseMirrorNode {
  return { type: "doc", content: blocks };
}

describe("reconcile + projection round-trip", () => {
  it("assigns stable ids and round-trips through ProseMirror", () => {
    const d1 = doc(para("a", "Hello"), para("b", "World"));
    const s1 = fromProseMirror(d1, "deviceA");
    const projected = toProseMirror(s1);
    expect(projected.content).toHaveLength(2);
    expect(projected.content?.[0].attrs?.blockId).toBe("a");
    expect(extractText(s1)).toBe("Hello World");
  });

  it("only bumps the edited block (minimal delta)", () => {
    const base = fromProseMirror(doc(para("a", "Hello"), para("b", "World")), "A");
    const edited = reconcile(base, doc(para("a", "Hello"), para("b", "World!!")), "A");
    const delta = diffDelta(base, edited);
    expect(delta).toHaveLength(1);
    expect(delta[0].id).toBe("b");
  });

  it("tombstones a removed block (delete is captured)", () => {
    const base = fromProseMirror(doc(para("a", "keep"), para("b", "remove")), "A");
    const edited = reconcile(base, doc(para("a", "keep")), "A");
    expect(edited.blocks["b"].deleted).toBe(true);
    // Projection hides tombstones.
    expect(toProseMirror(edited).content).toHaveLength(1);
  });

  it("gives new blocks fresh identity + order after their predecessor", () => {
    const base = fromProseMirror(doc(para("a", "one")), "A");
    const edited = reconcile(base, doc(para("a", "one"), para("c", "two")), "A");
    expect(edited.blocks["c"]).toBeDefined();
    expect(edited.blocks["c"].fracIndex > edited.blocks["a"].fracIndex).toBe(true);
  });

  it("reconcile is deterministic (same inputs → same output)", () => {
    const base = fromProseMirror(doc(para("a", "x")), "A");
    const r1 = reconcile(base, doc(para("a", "y")), "A");
    const r2 = reconcile(base, doc(para("a", "y")), "A");
    expect(r1).toEqual(r2);
  });
});
