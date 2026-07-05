import "fake-indexeddb/auto";

// jest-dom matchers are only meaningful (and only importable) in a DOM env.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
}

// Ensure Web Crypto is available for the CRDT's randomUUID in all environments.
if (typeof globalThis.crypto === "undefined") {
  const { webcrypto } = await import("node:crypto");
  // @ts-expect-error assign node webcrypto to global
  globalThis.crypto = webcrypto;
}
