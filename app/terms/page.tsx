// app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Lifebook.AI",
  description: "The terms for using Lifebook.AI.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-4 text-gray-300">
          By using this site and joining the waitlist, you agree to be contacted about early access and launch updates.
          The service is provided “as is” during pre-launch. For any questions, email{" "}
          <a href="mailto:support@uselifebook.ai" className="underline">support@uselifebook.ai</a>.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Founders offer</h2>
        <p className="mt-2 text-gray-300">
          The founder badge + first month of Pro free is limited to the first 150 activations at public launch.
          Card required; you can cancel anytime. We may modify or end the offer before launch.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Acceptable use</h2>
        <p className="mt-2 text-gray-300">
          Don’t upload illegal or abusive content. We may remove content or restrict access to protect the service.
        </p>

        <p className="mt-8 text-sm text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </main>
  );
}
