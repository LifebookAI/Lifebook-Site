"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">(
    "idle"
  );

  async function join(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    try {
      const fd = new FormData(e.currentTarget);
      // TODO: replace YOUR_FORMSPREE_ID with your real one from formspree.io
      const resp = await fetch("https://formspree.io/f/mvgqlzvn", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      if (resp.ok) {
        setStatus("ok");
        setEmail("");
      } else {
        setStatus("err");
      }
    } catch {
      setStatus("err");
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      {/* Top nav */}
      <header className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-mark.png" alt="Lifebook AI" width={32} height={32} />
          <span className="font-semibold">
            Lifebook<span className="text-cyan-300">.AI</span>
          </span>
        </Link>
        <nav className="flex gap-6 text-sm">
          <a href="#features" className="hover:opacity-80">Features</a>
          <a href="#pricing" className="hover:opacity-80">Pricing</a>
          <a href="#contact" className="hover:opacity-80">Contact</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Turn long recordings into{" "}
            <span className="text-cyan-300">clean notes, clips</span>, and
            searchable archives.
          </h1>
          <p className="mt-4 text-gray-300">
            Upload audio or video → accurate transcripts, chaptered summaries,
            and auto-detected highlight clips in minutes.
          </p>

          {/* Waitlist form */}
          <form onSubmit={join} className="mt-6 flex gap-3 max-w-md">
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <button
              disabled={status === "sending"}
              className="rounded-lg px-4 py-3 bg-cyan-400 text-[#0B1220] font-medium disabled:opacity-60"
            >
              {status === "sending" ? "Sending..." : "Join waitlist"}
            </button>
            <input type="hidden" name="_subject" value="New waitlist signup" />
            <input type="hidden" name="source" value="landing" />
          </form>
          {status === "ok" && (
            <p className="mt-2 text-sm text-green-400">
              Thanks! Check your inbox.
            </p>
          )}
          {status === "err" && (
            <p className="mt-2 text-sm text-red-400">
              Something went wrong. Try again.
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white/5 p-8 ring-1 ring-white/10">
          <Image
            src="/wordmark.png"
            alt="Lifebook AI"
            width={900}
            height={500}
            className="w-full h-auto"
            priority
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 mt-10 grid sm:grid-cols-2 gap-4">
        {[
          ["Fast, accurate transcripts", "Whisper + GPT-5 routing for quality and speed."],
          ["Smart summaries", "Bullet points & chaptered notes with timestamps."],
          ["Auto clips", "Find engaging moments; export MP4 (720p/1080p)."],
          ["Searchable archive", "Find anything by keyword, chapter, or tag."],
        ].map(([title, copy]) => (
          <div key={title} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-gray-300 text-sm mt-2">{copy}</p>
          </div>
        ))}
      </section>

      {/* Pricing (placeholder) */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 mt-14">
        <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <h2 className="text-2xl font-semibold">Early pricing</h2>
          <p className="text-gray-300 mt-2">
            Founding users get 3 months free. Paid plans from $0 while in private beta.
          </p>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="contact" className="mx-auto max-w-6xl px-6 mt-16 mb-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Lifebook.AI
          </p>
          <div className="flex gap-6 text-sm">
            <a href="mailto:founder@lifebook.ai" className="hover:underline">
              founder@lifebook.ai
            </a>
            <a
              href="https://x.com/yourhandle"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              X/Twitter
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
