// app/contact/page.tsx
export const metadata = {
  title: "Contact — Lifebook.AI",
  description: "Get in touch with Lifebook.AI support.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0b1020] text-white">
      <section className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Contact Lifebook.AI</h1>
        <p className="mt-3 text-gray-300">
          The quickest way to reach us is by email. We usually reply within 1 business day.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-gray-300">Email</p>
          <a
            href="mailto:support@uselifebook.ai"
            className="mt-1 inline-block text-lg underline hover:no-underline"
          >
            support@uselifebook.ai
          </a>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Tip: include any links or context that will help us help you faster.
        </p>
      </section>
    </main>
  );
}
