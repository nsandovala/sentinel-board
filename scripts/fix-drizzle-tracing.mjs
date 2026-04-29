import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const target = join(root, "node_modules", "drizzle-orm", "tracing.js");

if (existsSync(target)) {
  process.exit(0);
}

const content = `import { iife } from "./tracing-utils.js";
import { npmVersion } from "./version.js";

let otel;
let rawTracer;

export const tracer = {
  startActiveSpan(name, fn) {
    if (!otel) {
      return fn();
    }

    if (!rawTracer) {
      rawTracer = otel.trace.getTracer("drizzle-orm", npmVersion);
    }

    return iife(
      (otel2, rawTracer2) =>
        rawTracer2.startActiveSpan(name, (span) => {
          try {
            return fn(span);
          } catch (e) {
            span.setStatus({
              code: otel2.SpanStatusCode.ERROR,
              message: e instanceof Error ? e.message : "Unknown error",
            });
            throw e;
          } finally {
            span.end();
          }
        }),
      otel,
      rawTracer,
    );
  },
};
`;

writeFileSync(target, content, "utf8");
console.log("Patched drizzle-orm/tracing.js");
