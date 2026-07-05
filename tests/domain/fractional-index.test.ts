import { describe, expect, it } from "vitest";
import {
  generateKeyBetween,
  keyAfter,
  keyBefore,
  initialKeys,
} from "@/domain/crdt/fractional-index";

describe("fractional indexing", () => {
  it("generates a key between two keys", () => {
    const a = "a";
    const c = "c";
    const b = generateKeyBetween(a, c);
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });

  it("supports open ends", () => {
    const first = keyAfter(null);
    const second = keyAfter(first);
    expect(first < second).toBe(true);
    expect(keyBefore(first) < first).toBe(true);
  });

  it("can always insert between adjacent keys (unbounded precision)", () => {
    const lo = "a";
    let hi = "b";
    // Repeatedly insert between lo and the midpoint; must always succeed + order.
    for (let i = 0; i < 50; i++) {
      const mid = generateKeyBetween(lo, hi);
      expect(lo < mid && mid < hi).toBe(true);
      hi = mid;
    }
  });

  it("initialKeys are strictly increasing", () => {
    const keys = initialKeys(10);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i - 1] < keys[i]).toBe(true);
    }
  });

  it("rejects inverted bounds", () => {
    expect(() => generateKeyBetween("c", "a")).toThrow();
  });
});
