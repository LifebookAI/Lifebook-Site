// app/privacy/page.tsx
export const metadata = { title: "Privacy Policy — Lifebook.AI" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16 opacity-100">
      <div className="mx-auto max-w-3xl leading-relaxed">
        <h1 className="text-3xl font-semibold text-white">Privacy Policy</h1>

        <p className="mt-4 text-gray-100">
          We keep things simple: we only collect what’s needed to run the waitlist and
          improve the product. No sale of personal data.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">What we collect</h2>
        <ul className="mt-3 list-disc pl-5 space-y-1 text-gray-100 marker:text-gray-300">
          <li>Email (waitlist)</li>
          <li>Basic site analytics (aggregate)</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-white">How you control your data</h2>
        <ul className="mt-3 list-disc pl-5 space-y-1 text-gray-100 marker:text-gray-300">
          <li>Unsubscribe from emails anytime (link in every email).</li>
          <li>
            <span className="font-medium text-white">Before public launch:</span>{" "}
            request data deletion by emailing{" "}
            <a
              className="underline text-sky-300 hover:text-sky-200"
              href="mailto:support@uselifebook.ai"
            >
              support@uselifebook.ai
            </a>.
          </li>
          <li>
            <span className="font-medium text-white">After launch:</span> you’ll be able
            to delete your account and all associated data yourself from{" "}
            <span className="italic">Settings → Account</span> in the app. We’ll also
            offer a one-click data export.
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-white">Deletion timelines</h2>
        <p className="mt-3 text-gray-100">
          When you delete or request deletion, we remove active records promptly and
          purge logs/backups within ~30 days. Where we use third-party processors (e.g.,
          email, hosting), we propagate the deletion there as well.
        </p>

        <p className="mt-12 text-sm text-gray-300">Last updated: 8/14/2025</p>
      </div>
    </main>
  );
}
