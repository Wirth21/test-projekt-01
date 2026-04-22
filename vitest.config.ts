import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./tests/setup.ts"],
    // Serialize test files: force_delete_test_project takes an ACCESS
    // EXCLUSIVE lock on project_members (via ALTER TABLE DISABLE TRIGGER),
    // which deadlocks with parallel test files performing writes.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
