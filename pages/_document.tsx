import { Html, Head, Main, NextScript } from "next/document";

/**
 * Minimal custom Document for Lifebook-Site.
 * Used by Next.js for the overall HTML shell; app/ routes still render via app/layout.tsx.
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
