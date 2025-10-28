/** Flat ESLint for Next.js + TypeScript (scoped correctly) */
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

// Only borrow Next’s rules from its legacy config object
const nextCoreWebVitalsRules = nextPlugin?.configs?.["core-web-vitals"]?.rules ?? {};

/** Helper: scope every tseslint typed config to TS files + parserOptions.project */
const typedTsConfigs = tseslint.configs.recommendedTypeChecked.map((c) => ({
  ...c,
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    ...(c.languageOptions ?? {}),
    parserOptions: {
      ...(c.languageOptions?.parserOptions ?? {}),
      project: ["./tsconfig.json"],
      tsconfigRootDir: process.cwd(),
    },
  },
}));

export default [
  // Ignore build artifacts
  { ignores: ["**/.next/**", "**/out/**", "**/dist/**", "**/node_modules/**"] },

  // JS files: enable Next rules; DO NOT enable TS typed rules here
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextCoreWebVitalsRules,
    },
  },

  // TS files: enable typed TS rules + Next rules
  ...typedTsConfigs,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextCoreWebVitalsRules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
];
