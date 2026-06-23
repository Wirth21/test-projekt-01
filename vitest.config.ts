import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30_000,
    // 60s (not 30s): setup/teardown hooks make several round-trips to the
    // shared Supabase Free instance, whose disk-IO budget is tight and where
    // force_delete_test_project grabs a global ALTER TABLE lock. Under that
    // contention a hook can legitimately exceed 30s and flake a green build.
    hookTimeout: 60_000,
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
