import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    env: {
      // Eigene Testdatenbank – wird bei jedem Testlauf geleert
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ams_test",
    },
  },
});
