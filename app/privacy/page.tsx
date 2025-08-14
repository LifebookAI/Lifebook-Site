// app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Lifebook.AI",
  description: "How Lifebook.AI handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-4 text-gray-300">
          We keep things simple: we only collect what’s needed to run the waitlist and improve the product.
          No sale of personal data. You can ask us to delete your data anytime by emailing{" "}
          <a href="mailto:support@uselifebook.ai" className="underline">support@uselifebook.ai</a>.
        </p>

        <h2 className="mt-8 text-xl font-semibold">What we collect</h2>
        <ul className="mt-2 list-disc pl-5 text-gray-300">
          <li>Email (waitlist)</li>
          <li>Basic site analytics (aggregate)</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Your choices</h2>
        <ul className="mt-2 list-disc pl-5 text-gray-300">
          <li>Unsubscribe from emails anytime</li>
          <li>Request data deletion via support@uselifebook.ai</li>
        </ul>

        <p className="mt-8 text-sm text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </main>
  );
}
