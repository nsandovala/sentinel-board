import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required to run Drizzle against Postgres. Define it in .env.local or .env.",
  );
}

/** @type {import("drizzle-kit").Config} */
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
};
