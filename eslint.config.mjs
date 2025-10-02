/// Flat ESLint config (single export)
import tseslint from "typescript-eslint";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat();

/**
 * We use:
 * - Next's "core-web-vitals" rules via compat (so 
ext lint is satisfied)
 * - typescript-eslint "recommended" (NON type-checked) to avoid parserOptions.project errors
 * - our strict rules: no-explicit-any + no-unused-vars
 */
export default [
  // Next.js rules (from eslint-config-next)
  ...compat.config({
    extends: ["next/core-web-vitals"],
  }),

  // TypeScript rules for .ts/.tsx (non type-checked)
  ...tseslint.configs.recommended.map(cfg => ({
    ...cfg,
    files: ["**/*.{ts,tsx}"],
  })),

  // Our stricter rules for TS files
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  },

  // Optionally: keep JS lint basic without TS type rules
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    rules: {
      // place any JS-only tweaks here if needed
    }
  }
];
