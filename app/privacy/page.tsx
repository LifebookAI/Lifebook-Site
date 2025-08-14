// app/privacy/page.tsx
export const metadata = { title: "Privacy Policy — Lifebook.AI" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl text-gray-200 leading-relaxed">
        <h1 className="text-3xl font-semibold text-white">Privacy Policy</h1>

        <p className="mt-4">
          We keep things simple: we only collect what’s needed to run the waitlist and
          improve the product. No sale of personal data. You can ask us to delete your
          data anytime by emailing{" "}
          <a
            className="underline text-sky-300 hover:text-sky-200"
            href="mailto:support@uselifebook.ai"
          >
            support@uselifebook.ai
          </a>.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-white">What we collect</h2>
        <ul className="mt-3 list-disc pl-5 space-y-1">
          <li>Email (waitlist)</li>
          <li>Basic site analytics (aggregate)</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold text-white">Your choices</h2>
        <ul className="mt-3 list-disc pl-5 space-y-1">
          <li>Unsubscribe from emails anytime.</li>
          <li>
            Request data deletion via{" "}
            <a
              className="underline text-sky-300 hover:text-sky-200"
              href="mailto:support@uselifebook.ai"
            >
              support@uselifebook.ai
            </a>.
          </li>
        </ul>

        <p className="mt-12 text-sm text-gray-400">Last updated: 8/14/2025</p>
      </div>
    </main>
  );
}
