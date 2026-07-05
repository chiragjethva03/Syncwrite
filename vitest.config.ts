import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    // Default to the fast Node environment; component tests opt into a DOM
    // per-file with `// @vitest-environment jsdom`. This keeps the pure
    // domain/sync suites free of heavy (and, on Node < 20.19, ESM-incompatible)
    // browser polyfills.
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/server/services/**", "src/lib/sync/**"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
