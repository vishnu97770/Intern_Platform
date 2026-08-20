import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 20000,
    // Integration tests share one Postgres schema; run files serially so
    // they don't race each other truncating tables mid-test.
    fileParallelism: false,
  },
});
