/// Flat ESLint config (single export) — generated to remove duplicate exports
// Keep this single export default array; add any other config blocks inside it.
import tseslint from "typescript-eslint";

export default [
  // base from next lint if you had it; keep your other blocks here as objects
  ...tseslint.configs.recommendedTypeChecked, // safe defaults (needs tsconfig.json "project" if you want type-aware rules)

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ["tsconfig.json"], // comment out if you do not want type-aware linting
        tsconfigRootDir: process.cwd(),
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }]
    }
  }
];
