import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      "server-only": path.resolve(root, "tests/unit/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Unit tests never talk to a backend: keep real credentials out of the process.
    env: {
      NEXT_PUBLIC_INSFORGE_BASE_URL: "https://unit-tests.invalid",
      NEXT_PUBLIC_INSFORGE_ANON_KEY: "unit-test-anon-key",
      INSFORGE_API_KEY: "",
      CRON_SECRET: "",
    },
  },
});
