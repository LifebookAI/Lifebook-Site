// app/terms/page.tsx
export const metadata = { title: "Terms of Service — Lifebook.AI" };

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl text-gray-200 leading-relaxed">
        <h1 className="text-3xl font-semibold text-white">Terms of Service</h1>

        <p className="mt-4">
          By using Lifebook.AI, you agree to these terms. We may update them from time
          to time and will update the date below.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">Beta / early access</h2>
        <p className="mt-3">
          The service is in active development and provided “as is.” Expect changes and
          occasional downtime.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Acceptable use</h2>
        <p className="mt-3">
          Don’t upload unlawful content or violate others’ rights. You’re responsible for
          securing permission to upload any third-party media.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Privacy</h2>
        <p className="mt-3">
          See our{" "}
          <a
            className="underline text-sky-300 hover:text-sky-200"
            href="/privacy"
          >
            Privacy Policy
          </a>{" "}
          for how we handle data.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Contact</h2>
        <p className="mt-3">
          Questions? Email{" "}
          <a
            className="underline text-sky-300 hover:text-sky-200"
            href="mailto:support@uselifebook.ai"
          >
            support@uselifebook.ai
          </a>.
        </p>

        <p className="mt-12 text-sm text-gray-400">Last updated: 8/14/2025</p>
      </div>
    </main>
  );
}
