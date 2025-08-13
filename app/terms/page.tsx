// app/terms/page.tsx
export const metadata = {
  title: "Terms of Service — Lifebook.AI",
  description:
    "The terms that govern your use of Lifebook.AI.",
};

export default function Page() {
  return (
    <main className="min-h-[70vh] bg-[#0b1220] text-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-gray-300">Last updated: August 2025</p>

        <div className="mt-8 space-y-6 text-gray-200">
          <p>
            By using Lifebook.AI, you agree to these terms. If you don’t agree, please don’t use the service.
          </p>

          <h2 className="text-xl font-semibold text-white">Use of the service</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You’re responsible for uploaded content and having rights to it.</li>
            <li>Don’t misuse the service or break the law.</li>
          </ul>

          <h2 className="text-xl font-semibold text-white">Disclaimer</h2>
          <p>
            The service is provided “as is” without warranties. We limit liability to the maximum
            extent permitted by law.
          </p>

          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p>
            Questions? <a className="underline" href="mailto:support@uselifebook.ai">support@uselifebook.ai</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
