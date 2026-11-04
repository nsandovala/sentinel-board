import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // Keep developer tooling, private configuration and QA evidence out of
  // production traces, including routes with dynamic filesystem reads.
  outputFileTracingExcludes: {
    "/*": [
      "./.env*",
      "./.claude/**/*",
      "./.codex/**/*",
      "./certificates/**/*",
      "./**/*.pem",
      "./outputs/**/*",
      "./tests/**/*",
      "./**/*.test.*",
      "./docs/**/*",
      "./scripts/**/*",
      "./AGENT.md",
      "./CONTRIBUTING.md",
      "./README.md",
      "./README_DEPLOY.md",
      "./ROADMAP.md",
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
