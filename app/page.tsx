import Link from "next/link";

export const metadata = {
  title: "Lifebook.AI — Turn long recordings into clean notes, clips, and a searchable archive.",
  description:
    "Upload audio or video. Get accurate transcripts, chaptered summaries, and auto-detected highlight clips—ready to share.",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#0b1020] text-white">
      {/* top nav */}
      <header className="mx-auto w-full max-w-6xl px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          <span className="font-semibold">Lifebook.<span className="text-cyan-400">AI</span></span>
        </Link>

        <nav className="flex items-center gap-6 text-sm text-gray-300">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
          {/* Contact goes straight to email */}
          <a href="mailto:support@uselifebook.ai" className="hover:text-white">Contact</a>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-4 pb-12">
        <h1 className="max-w-3xl text-4xl sm:text-5xl font-bold leading-tight">
          Turn long recordings into <span className="text-cyan-400">clean</span><span> notes, </span>
          <span className="text-cyan-400">clips</span>, and a <span className="text-cyan-400">searchable</span> archive.
        </h1>

        {/* founder promo */}
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <strong className="text-white">EARLY ACCESS</strong>
          <span>• Founders get a badge + first month of Pro free.</span>
          <span className="text-gray-400">(Limited to first 150 activations.)</span>
        </div>

        {/* waitlist form (Formspree) */}
        <form
          action="https://formspree.io/f/mvgqlzvn" /* <- your Formspree endpoint */
          method="POST"
          className="mt-6 flex w-full max-w-md gap-2"
        >
          <input
            required
            type="email"
            name="email"
            placeholder="you@example.com"
            className="h-11 flex-1 rounded-lg border border-white/10 bg-white/5 px-4 outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            className="h-11 rounded-lg bg-cyan-500 px-4 font-medium text-black hover:bg-cyan-400"
          >
            Join waitlist
          </button>
        </form>

        <p className="mt-2 text-xs text-gray-400">
          No spam. We’ll only email you about launch and early access.{" "}
          <Link href="#whats-included" className="underline hover:no-underline">See what’s included</Link>{" "}
          · <Link href="/privacy" className="underline hover:no-underline">Privacy</Link>{" "}
          · <Link href="/terms" className="underline hover:no-underline">Terms</Link>{" "}
          · {/* clickable email */}
          <a href="mailto:support@uselifebook.ai" className="underline hover:no-underline">support@uselifebook.ai</a>
        </p>

        {/* feature cards */}
        <div id="features" className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">High-accuracy transcription</h3>
            <p className="mt-1 text-sm text-gray-400">
              Upload audio/video and get clean text you can trust.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">Chaptered summaries</h3>
            <p className="mt-1 text-sm text-gray-400">
              Bullet summaries with timestamps for fast scanning.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">Auto highlight clips</h3>
            <p className="mt-1 text-sm text-gray-400">
              We pick the most engaging moments ready for sharing.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">Searchable archive</h3>
            <p className="mt-1 text-sm text-gray-400">
              Find moments by keyword, chapter, or tag across projects.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">One-click exports</h3>
            <p className="mt-1 text-sm text-gray-400">
              TXT, DOCX, PDF, and MP4 (720p/1080p by plan).
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">Works with your tools</h3>
            <p className="mt-1 text-sm text-gray-400">
              Import from Drive; export to Notion; share to Slack.
            </p>
          </div>
        </div>

        {/* how it works */}
        <section id="how" className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="font-medium">Step 1</h3>
              <p className="mt-1 text-sm text-gray-400">
                Upload: drag in audio or video—big files welcome.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="font-medium">Step 2</h3>
              <p className="mt-1 text-sm text-gray-400">
                Process: we transcribe, summarize, and pick highlights.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="font-medium">Step 3</h3>
              <p className="mt-1 text-sm text-gray-400">
                Export: copy notes or download clips to share anywhere.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">FAQ</h2>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">What does the Founder offer include?</h3>
            <p className="mt-1 text-sm text-gray-400">
              Founders receive a special badge in the app and their first month of Pro free.
              Limited to the first 150 activations. Card required; cancel anytime.
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">When can I redeem it?</h3>
            <p className="mt-1 text-sm text-gray-400">
              At public launch. Join the waitlist and we’ll email instructions.
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-medium">Will pricing include overages?</h3>
            <p className="mt-1 text-sm text-gray-400">
              No overages. Plans include monthly minutes; optional minute packs never auto-renew.
            </p>
          </div>
        </section>
      </section>

      {/* footer */}
      <footer className="mt-16 border-t border-white/10">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} Lifebook.AI</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <a href="mailto:support@uselifebook.ai" className="hover:text-white">
              support@uselifebook.ai
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
