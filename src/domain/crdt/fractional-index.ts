/**
 * Fractional indexing.
 *
 * To keep block ordering convergent under concurrent inserts, each block stores
 * an order *key* (a string) rather than an array position. To insert between two
 * blocks we generate a key that sorts lexicographically between their keys —
 * without ever having to renumber siblings. This is the same technique Figma and
 * Google Docs-style editors use.
 *
 * Keys are strings over a fixed digit alphabet. `generateKeyBetween(a, b)`
 * returns a key strictly between `a` and `b` (either may be null for the
 * open ends). Two concurrent inserts at the "same" spot may produce equal keys;
 * callers break that tie deterministically by block id, so order still converges.
 *
 * This is a compact, dependency-free implementation adequate for document blocks.
 */

// Base-62 ordered alphabet. Lexicographic order == value order.
const DIGITS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
const MID = Math.floor(BASE / 2);

function digitVal(c: string): number {
  const v = DIGITS.indexOf(c);
  if (v < 0) throw new Error(`Invalid fractional-index digit: ${c}`);
  return v;
}

/**
 * Return a key strictly between `a` and `b` (lexicographically).
 * `a`/`b` may be null to represent the unbounded low/high end.
 * Invariant (when both provided): a < b.
 */
export function generateKeyBetween(
  a: string | null,
  b: string | null,
): string {
  if (a !== null && b !== null && a >= b) {
    throw new Error(`generateKeyBetween: expected a < b, got "${a}" >= "${b}"`);
  }

  // Walk digit by digit, borrowing precision until we can fit a value between.
  let prefix = "";
  let i = 0;
  for (;;) {
    const lo = i < (a?.length ?? 0) ? digitVal(a![i]) : 0;
    const hi = i < (b?.length ?? 0) ? digitVal(b![i]) : BASE;

    if (lo === hi) {
      // No room at this digit; carry the shared digit and descend.
      prefix += DIGITS[lo];
      i++;
      continue;
    }

    const mid = Math.floor((lo + hi) / 2);
    if (mid > lo) {
      // There's an integer strictly between lo and hi at this position.
      return prefix + DIGITS[mid];
    }

    // lo and hi are adjacent (hi === lo + 1): keep `a`'s digit and append a new
    // digit deeper down, biased to the middle so future inserts have room.
    prefix += DIGITS[lo];
    i++;
    // If we've run past `a`, we can just drop a middle digit and be done.
    if (i >= (a?.length ?? 0)) {
      return prefix + DIGITS[MID];
    }
  }
}

/** Convenience: append after the last key (or first key if list is empty). */
export function keyAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

/** Convenience: prepend before the first key. */
export function keyBefore(first: string | null): string {
  return generateKeyBetween(null, first);
}

/**
 * Assign evenly-spaced keys to an initial ordered list of N items.
 * Used when importing a legacy document that has no fractional indices yet.
 */
export function initialKeys(count: number): string[] {
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i++) {
    prev = keyAfter(prev);
    keys.push(prev);
  }
  return keys;
}
