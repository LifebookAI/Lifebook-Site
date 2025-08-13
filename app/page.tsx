// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      {/* Header */}
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo-mark.png" // Put a logo file named logo-mark.png in /public (see Step 5)
            alt="Lifebook.AI"
            className="h-8 w-8 rounded-md"
          />
          <span className="font-semibold tracking-tight">Lifebook.AI</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-white/70">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how-it-works" className="hover:text-white">How it works</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-10 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">
          Turn long recordings into <span className="text-cyan-400">clean notes</span>,{" "}
          <span className="text-cyan-400">clips</span>, and a{" "}
          <span className="text-cyan-400">searchable archive</span>.
        </h1>
        <p className="mt-4 text-white/70">
          Upload audio or video. Get accurate transcripts, chaptered summaries with
          timestamps, and auto-detected highlight clips—ready to share.
        </p>

        {/* Founder offer */}
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white/90 ring-1 ring-white/20">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          <span className="uppercase tracking-wide text-xs text-white/70">Early Access</span>
          <span className="text-white/60">•</span>
          <span>Founders get a badge + first month of <b>Pro</b> free.</span>
        </div>
        <p className="mt-2 text-xs text-white/60">
          Limited to the first 150 activations. New customers only. Card required; cancel anytime.
        </p>

        {/* Waitlist form */}
        <div className="mt-6">
          {/* Replace YOUR_FORM_ID with your actual Formspree form ID (keep https) */}
          <form
            action="https://formspree.io/f/YOUR_FORM_ID"
            method="POST"
            className="mx-auto flex max-w-xl items-center gap-2"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg bg-white/5 px-4 py-3 ring-1 ring-white/15 placeholder:text-white/40 focus:outline-none focus:ring-white/30"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-cyan-500 px-4 py-3 font-medium text-black hover:bg-cyan-400 transition"
            >
              Join waitlist
            </button>
          </form>
          <p className="mt-2 text-xs text-white/50">
            We’ll only email you about launch and early access. No spam.
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <a href="#features" className="text-white/80 hover:text-white underline underline-offset-4">
              See what’s included
            </a>
            <span className="text-white/30">•</span>
            <Link href="/privacy" className="text-white/60 hover:text-white underline underline-offset-4">
              Privacy
            </Link>
            <span className="text-white/30">•</span>
            <Link href="/terms" className="text-white/60 hover:text-white underline underline-offset-4">
              Terms
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "High-accuracy transcription",
              desc: "Upload audio/video and get clean text you can trust.",
            },
            {
              title: "Chaptered summaries",
              desc: "Bullet summaries with timestamps for fast scanning.",
            },
            {
              title: "Auto highlight clips",
              desc: "We pick the most engaging moments ready for sharing.",
            },
            {
              title: "Searchable archive",
              desc: "Find moments by keyword, chapter, or tag across projects.",
            },
            {
              title: "One-click exports",
              desc: "TXT, DOCX, PDF, and MP4 (720p/1080p by plan).",
            },
            {
              title: "Works with your tools",
              desc: "Import from Drive; export to Notion; share to Slack.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h3 className="font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-white/70">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-6 pb-12">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { n: 1, t: "Upload", d: "Drag in audio or video—big files welcome." },
            { n: 2, t: "Process", d: "We transcribe, summarize, and pick highlights." },
            { n: 3, t: "Export", d: "Copy notes or export clips to share anywhere." },
          ].map((s) => (
            <li key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-cyan-400 text-sm">Step {s.n}</div>
              <div className="mt-1 font-medium">{s.t}</div>
              <p className="mt-1 text-sm text-white/70">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ (short) */}
      <section id="faq" className="mx-auto max-w-4xl px-6 pb-16">
        <h2 className="text-2xl font-semibold">FAQ</h2>
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="font-medium">What does the Founder offer include?</div>
            <p className="mt-2 text-sm text-white/70">
              Founders receive a special badge in the app and their first month of Pro free.
              Limited to the first 150 activations. Card required; cancel anytime.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="font-medium">When can I redeem it?</div>
            <p className="mt-2 text-sm text-white/70">
              At public launch. Join the waitlist and we’ll email instructions.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="font-medium">Will pricing include overages?</div>
            <p className="mt-2 text-sm text-white/70">
              No overages. Plans include monthly minutes; optional minute packs never auto-renew.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-white/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} Lifebook.AI</div>
          <div className="flex items-center gap-4">
            <a href="mailto:support@uselifebook.ai" className="hover:text-white">support@uselifebook.ai</a>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
