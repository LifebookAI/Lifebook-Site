// app/privacy/page.tsx
export const metadata = {
  title: "Privacy Policy — Lifebook.AI",
  description:
    "How Lifebook.AI handles your data, security, and privacy.",
};

export default function Page() {
  return (
    <main className="min-h-[70vh] bg-[#0b1220] text-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-gray-300">Last updated: August 2025</p>

        <div className="mt-8 space-y-6 text-gray-200">
          <p>
            We respect your privacy. This page explains what we collect, why we collect it,
            and how we protect it.
          </p>

          <h2 className="text-xl font-semibold text-white">What we collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Basic account details (e.g., email) when you join the waitlist.</li>
            <li>Operational data needed to provide transcription and summaries.</li>
            <li>Product analytics (aggregated/anonymous) to improve the service.</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">How we use data</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To run and improve Lifebook.AI.</li>
            <li>To communicate important product updates (you can opt out).</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">Security</h2>
          <p>
            We use modern security practices and reputable infrastructure providers.
          </p>

          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p>
            Questions? Email <a className="underline" href="mailto:support@uselifebook.ai">support@uselifebook.ai</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
