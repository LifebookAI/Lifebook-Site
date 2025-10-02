/** Flat ESLint config for Next.js + TypeScript (typed rules) */
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

/** Pull only rules from Next's legacy preset to avoid legacy 'plugins' shape */
const nextCoreWebVitalsRules =
  (nextPlugin?.configs?.["core-web-vitals"]?.rules) ?? {};

export default [
  // TypeScript recommended with type information (flat)
  ...tseslint.configs.recommendedTypeChecked,

  // Our project settings
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      // register next plugin in flat style
      next: nextPlugin,
      "@next/next": nextPlugin, // support either rule prefix
    },
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      // Next.js rules
      ...nextCoreWebVitalsRules,

      // TS hygiene
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
];

