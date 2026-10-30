import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Unit tests only — pure functions, no DOM and no Next runtime. Anything that
// needs a browser or a live Supabase connection does not belong here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".claude/**"],
  },
  resolve: {
    // Mirrors the "@/*" -> "./*" path alias in tsconfig.json.
    alias: { "@": resolve(__dirname, ".") },
  },
});
