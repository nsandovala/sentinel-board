// No implicit target and no .env loading: applied QA history is not portable.
throw new Error(
  "No implicit migration target. Run npm run db:check or npm run db:reproduce. " +
  "Use drizzle.fresh.config.ts only for generation; live QA/production migration is disabled."
);

export {};
