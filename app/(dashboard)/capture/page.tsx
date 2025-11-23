import Link from "next/link";

export const metadata = {
  title: "Capture – Lifebook.AI",
  description:
    "Quickly capture notes, screens, and ideas, then file the useful ones into your Library.",
};

export default function CapturePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-xs text-neutral-500">
          <Link href="/" className="underline">
            Lifebook.AI
          </Link>{" "}
          / Capture
        </p>
        <h1 className="text-3xl font-semibold">Capture</h1>
        <p className="text-sm text-neutral-400">
          A simple place to quickly capture ideas, notes, and rough work before you decide what&apos;s
          worth turning into a real artifact in your Library.
        </p>
      </header>

      <section className="space-y-3 text-sm text-neutral-300">
        <p>
          For the MVP, capture lives wherever you already jot things down: a scratchpad, Notion page,
          or markdown file. When something turns into a real artifact, move it into your Library.
        </p>
        <p>
          As Lifebook grows, this page will give you lightweight tools to grab context from your
          screen, workflows, and study sessions, then file the useful pieces automatically.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Want a structured place to start?</h2>
        <p className="text-sm text-neutral-300">
          Begin with a Study Track and capture the work you do on each step, then promote the best
          pieces into your Library.
        </p>
        <Link
          href="/tracks"
          className="inline-flex items-center text-sm font-medium text-sky-400 hover:underline"
        >
          Browse Study Tracks
        </Link>
      </section>
    </main>
  );
}
