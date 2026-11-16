import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Tests never see the real DATABASE_URL: it is replaced by DATABASE_URL_TEST (or empty, which db-guard rejects).
function testEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), "");
  return { ...env, DATABASE_URL: env.DATABASE_URL_TEST ?? "" };
}

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node",
    env: testEnv(mode),
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
    fileParallelism: false,
    testTimeout: 30_000, // DB tests make many sequential round trips to a remote Neon database
  },
}));
