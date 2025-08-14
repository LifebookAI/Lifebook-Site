// app/terms/page.tsx
export const metadata = { title: "Terms of Service — Lifebook.AI" };

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16 opacity-100">
      <div className="mx-auto max-w-3xl leading-relaxed">
        <h1 className="text-3xl font-semibold text-white">Terms of Service</h1>

        <p className="mt-4 text-gray-100">
          By using Lifebook.AI, you agree to these terms. We may update them from time
          to time and will update the date below.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">Beta / early access</h2>
        <p className="mt-3 text-gray-100">
          The service is in active development and provided “as is.” Expect changes and
          occasional downtime.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Acceptable use</h2>
        <p className="mt-3 text-gray-100">
          Don’t upload unlawful content or violate others’ rights. You’re responsible for
          securing permission to upload any third-party media.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Your data & deletion</h2>
        <p className="mt-3 text-gray-100">
          Before public launch, you can request deletion via{" "}
          <a
            className="underline text-sky-300 hover:text-sky-200"
            href="mailto:support@uselifebook.ai"
          >
            support@uselifebook.ai
          </a>. After launch, you can delete your account and data yourself from{" "}
          <span className="italic">Settings → Account</span>. Deletions remove active
          records promptly; logs/backups are purged within ~30 days.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Privacy</h2>
        <p className="mt-3 text-gray-100">
          See our{" "}
          <a className="underline text-sky-300 hover:text-sky-200" href="/privacy">
            Privacy Policy
          </a>{" "}
          for details on collection and processing.
        </p>

        <h2 className="mt-8 text-xl font-semibold text-white">Contact</h2>
        <p className="mt-3 text-gray-100">
          Questions? Email{" "}
          <a
            className="underline text-sky-300 hover:text-sky-200"
            href="mailto:support@uselifebook.ai"
          >
            support@uselifebook.ai
          </a>.
        </p>

        <p className="mt-12 text-sm text-gray-300">Last updated: 8/14/2025</p>
      </div>
    </main>
  );
}
