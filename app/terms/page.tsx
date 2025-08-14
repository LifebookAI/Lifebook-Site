// app/terms/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Lifebook.AI",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-gray-100">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Terms of Service
      </h1>

      <p className="mt-4 text-gray-300">
        By using Lifebook.AI you agree to these terms.
      </p>

      <h2 className="mt-10 text-xl font-medium text-white">Use of service</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-200 marker:text-sky-400">
        <li>Be respectful of copyright. Upload content you have rights to use.</li>
        <li>No harmful, unlawful, or abusive activity.</li>
        <li>Service is provided “as-is”; we may modify or suspend features.</li>
      </ul>

      <h2 className="mt-10 text-xl font-medium text-white">Accounts & email</h2>
      <p className="mt-4 text-gray-200">
        You agree to receive essential emails (e.g., waitlist updates). You can
        unsubscribe from marketing at any time.
      </p>

      <h2 className="mt-10 text-xl font-medium text-white">Privacy</h2>
      <p className="mt-4 text-gray-200">
        See our{" "}
        <Link
          href="/privacy"
          className="text-sky-400 underline hover:text-sky-300"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <h2 className="mt-10 text-xl font-medium text-white">Contact</h2>
      <p className="mt-4 text-gray-200">
        Questions? Email{" "}
        <a
          href="mailto:support@uselifebook.ai"
          className="text-sky-400 underline hover:text-sky-300"
        >
          support@uselifebook.ai
        </a>
        .
      </p>

      <p className="mt-12 text-sm text-gray-400">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  );
}
