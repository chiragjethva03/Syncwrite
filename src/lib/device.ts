/**
 * Stable per-browser device identity.
 *
 * The deviceId is the tie-breaker in the CRDT's deterministic total order, so it
 * MUST be stable across reloads (persisted in localStorage) and unique per
 * browser profile. It is *not* a security identifier — it never grants access,
 * it only disambiguates concurrent writes.
 */
const KEY = "syncwrite:device-id";

let cached: string | null = null;

export function getDeviceId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  cached = id;
  return id;
}
