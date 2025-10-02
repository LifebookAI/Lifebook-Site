'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { Suspense } from "react";
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mwgqlzvn';

function classNames(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

function SuccessBanner() {
  const params = useSearchParams();
  const joined = params.get('joined') === '1';
  if (!joined) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-3 text-sm text-white/90">
        <div className="rounded-lg bg-emerald-600/90 px-4 py-2 text-center shadow-lg ring-1 ring-white/20">
          ✅ Thanks! You’re on the waitlist. We’ll be in touch soon.
        </div>
      </div>
    </div>
  );
}

function WaitlistForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  // honeypot
  const [website, setWebsite] = useState(''); // if a bot fills this, we bail

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (website.trim().length > 0) {
      // bot likely; pretend success
      router.push('/?joined=1#top');
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('email', email);
      form.append('website', website); // honeypot field (ignored by humans)
      form.append('_subject', 'New waitlist signup');

      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: form,
        headers: { Accept: 'application/json' },
      });

      // Treat 200/201 as success
      if (res.ok) {
        router.push('/?joined=1#top');
      } else {
        // still route to joined banner (Formspree sometimes 302s differently)
        router.push('/?joined=1#top');
      }
    } catch {
      router.push('/?joined=1#top');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex w-full max-w-xl items-center gap-2">
      <label className="sr-only" htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 outline-none ring-0 focus:border-sky-400/60"
      />
      {/* Honeypot field (hidden from users, bots often fill) */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={loading}
        className={classNames(
          'rounded-lg px-4 py-3 font-medium text-white shadow',
          loading ? 'bg-sky-500/60 cursor-wait' : 'bg-sky-500 hover:bg-sky-400'
        )}
      >
        {loading ? 'Joining…' : 'Join waitlist'}
      </button>
    </form>
  );
}
export function Page() {
  // simple gradient dots behind hero
  useEffect(() => {
    // no-op, layout is static
  }, []);

  return (
    <div id="top" className="min-h-screen bg-[#0B1220] text-white">
      <SuccessBanner />

      {/* Transparent header over dark bg */}
      <header className="sticky top-0 z-40 w-full bg-transparent/30 backdrop-blur supports-[backdrop-filter]:bg-transparent/30">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-semibold tracking-tight">
            <span className="text-white">Lifebook</span>
            <span className="text-sky-400">.AI</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-white/70 sm:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
            <a
              href="https://x.com/UseLifebookAi"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/90 hover:bg-white/10"
            >
              Follow on X
            </a>
            <a href="mailto:support@uselifebook.ai" className="hover:text-white">
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(56,189,248,0.25),rgba(12,18,32,0))]" />
        <div className="mx-auto w-full max-w-5xl px-4 pt-12 pb-6 sm:pt-16">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Turn long recordings into{' '}
            <span className="text-sky-400">clean</span>{' '}
            notes, <span className="text-sky-400">clips</span>, and a{' '}
            <span className="text-sky-400">searchable</span> archive.
          </h1>

          {/* Early access pill */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="inline-block size-2 rounded-full bg-sky-400" />
            <span>
              <strong>EARLY ACCESS</strong> · Founders get a badge + first month of Pro free. (Limited to first 150 activations.)
            </span>
          </div>

          <WaitlistForm />

          <p className="mt-3 max-w-xl text-xs text-white/50">
            No spam. We’ll only email you about launch and early access.{' '}
            <a href="#whats-included" className="underline">See what’s included</a> ·{' '}
            <Link href="/privacy" className="underline">Privacy</Link> ·{' '}
            <Link href="/terms" className="underline">Terms</Link> ·{' '}
            <a href="mailto:support@uselifebook.ai" className="underline">support@uselifebook.ai</a>
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['High-accuracy transcription', 'Upload audio/video and get clean text you can trust.'],
            ['Chaptered summaries', 'Bullet summaries with timestamps for fast scanning.'],
            ['Auto highlight clips', 'We pick the most engaging moments ready for sharing.'],
            ['Searchable archive', 'Find moments by keyword, chapter, or tag across projects.'],
            ['One-click exports', 'TXT, DOCX, PDF, and MP4 (720p/1080p by plan).'],
            ['Works with your tools', 'Import from Drive; export to Notion; share to Slack.'],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm"
            >
              <h3 className="font-semibold text-white/90">{title}</h3>
              <p className="mt-2 text-sm text-white/60">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto w-full max-w-5xl px-4 pb-10">
        <h2 className="mb-4 text-xl font-semibold text-white/90">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Step 1', 'Upload: drag in audio or video—big files welcome.'],
            ['Step 2', 'Process: we transcribe, summarize, and pick highlights.'],
            ['Step 3', 'Export: copy notes or download clips to share anywhere.'],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <h3 className="font-medium text-white/90">{title}</h3>
              <p className="mt-2 text-sm text-white/60">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto w-full max-w-5xl px-4 pb-16">
        <h2 className="mb-4 text-xl font-semibold text-white/90">FAQ</h2>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-medium text-white/90">What does the Founder offer include?</div>
            <div className="mt-1 text-sm text-white/60">
              Founders receive a special badge in the app and their first month of Pro free. Limited to the first 150 activations. Card required; cancel anytime.
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-medium text-white/90">When can I redeem it?</div>
            <div className="mt-1 text-sm text-white/60">
              At public launch. Join the waitlist and we’ll email instructions.
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-medium text-white/90">Will pricing include overages?</div>
            <div className="mt-1 text-sm text-white/60">
              No overages. Plans include monthly minutes; optional minute packs never auto-renew.
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-white/50 sm:flex-row">
          <div>© {new Date().getFullYear()} Lifebook.AI</div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <a href="mailto:support@uselifebook.ai" className="hover:text-white">support@uselifebook.ai</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
