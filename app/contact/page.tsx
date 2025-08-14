// app/contact/page.tsx
export const metadata = {
  title: "Contact — Lifebook.AI",
  description: "Get in touch with Lifebook.AI support.",
};

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M18.9 2H22l-7.1 8.1L23.3 22h-6.4l-5-6.6L5.9 22H2.8l7.6-8.7L1.7 2h6.5l4.6 6.1L18.9 2zM17.8 20h1.8L8.4 4H6.6l11.2 16z"/>
    </svg>
  );
}

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#0b1020] text-white">
      <section className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">Contact Lifebook.AI</h1>
        <p className="mt-3 text-gray-300">
          The quickest way to reach us is email. We usually reply within 1 business day.
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

        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-gray-300 mb-3">Social</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://x.com/UseLifebookAi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10"
            >
              <IconX className="h-4 w-4" />
              <span>X (Twitter)</span>
            </a>
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Tip: include any links or context that will help us help you faster.
        </p>
      </section>
    </main>
  );
}
