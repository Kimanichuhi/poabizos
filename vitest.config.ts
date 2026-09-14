import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal standalone config: unit tests only run against services/repositories
// (plain TS, no React/DOM, no Vite plugins), so we don't pull in the
// Lovable Vite/TanStack Start config here — that config is build/dev-server
// oriented, not test oriented, and importing it would drag in SSR/router
// plugins this suite doesn't need.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@modules": path.resolve(__dirname, "./src/modules"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@infrastructure": path.resolve(__dirname, "./src/infrastructure"),
      "@sdk": path.resolve(__dirname, "./src/sdk"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
