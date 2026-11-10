import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    env: {
      // Eigene Testdatenbank – wird bei jedem Testlauf geleert.
      // Rolle ams_app ohne Superuser-Rechte, damit Row-Level Security wirkt (scripts/db-app-role.sql).
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://ams_app:ams_app@localhost:5432/ams_test",
    },
  },
});
