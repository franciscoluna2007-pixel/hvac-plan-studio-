import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    // Workspace tooling, generated release packages, and sibling worktrees are
    // not application source and may carry their own lint configuration.
    ".agents/**",
    ".drag-fix-worktree/**",
    ".impeccable/**",
    ".sites-runtime/**",
    "test-results/**",
    // Third-party PDF.js worker copied verbatim for browser execution.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
