// app/contact/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Lifebook.AI",
  description: "Get in touch with the Lifebook.AI team.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">Contact</h1>
        <p className="mt-3 text-gray-400">
          Questions about the beta, partnerships, or press? We’d love to hear from you.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:support@uselifebook.ai"
            className="rounded-xl border border-white/15 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <h2 className="font-medium">Email</h2>
            <p className="mt-1 text-sm text-gray-400">support@uselifebook.ai</p>
          </a>

          <a
            href="https://x.com/UseLifebookAi"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/15 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <h2 className="font-medium">X (Twitter)</h2>
            <p className="mt-1 text-sm text-gray-400">@UseLifebookAi</p>
          </a>
        </div>

        <p className="mt-10 text-sm text-gray-500">
          Prefer not to email? You can also reply to our waitlist confirmation message—those reach us too.
        </p>

        <div className="mt-10">
          <Link href="/" className="inline-block rounded-lg border px-4 py-2">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
