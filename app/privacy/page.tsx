// app/privacy/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Lifebook.AI",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>

      <p className="mt-4 text-gray-100">
        We keep things simple: we only collect what’s needed to run the waitlist
        and improve the product. No sale of personal data.
      </p>

      <h2 className="mt-10 text-xl font-medium text-white">What we collect</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-100 marker:text-sky-400">
        <li>Email (waitlist)</li>
        <li>Basic site analytics (aggregate)</li>
      </ul>

      <h2 className="mt-10 text-xl font-medium text-white">Your choices</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-100 marker:text-sky-400">
        <li>Unsubscribe from emails anytime.</li>
        <li>
          Delete your data in-app (when available). Until then, request deletion at{" "}
          <a href="mailto:support@uselifebook.ai" className="text-sky-400 underline hover:text-sky-300">
            support@uselifebook.ai
          </a>.
        </li>
      </ul>

      <p className="mt-12 text-sm text-gray-400">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
    </main>
  );
}





