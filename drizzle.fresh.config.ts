import { defineConfig } from "drizzle-kit";

// Generation only. No credentials and no .env loading; execution is in memory.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./migrations/fresh",
  dialect: "postgresql",
});
