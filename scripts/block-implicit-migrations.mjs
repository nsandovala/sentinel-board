console.error("BLOCKED: no implicit database target. Use db:check (files only) or db:reproduce (empty, in-memory PostgreSQL). QA and production execution require a separately reviewed procedure.");
process.exitCode = 1;
