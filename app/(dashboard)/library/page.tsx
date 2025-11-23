import Link from "next/link";

export const metadata = {
  title: "Library – Lifebook.AI",
  description: "Keep the notes, runbooks, and artifacts you create while you learn in one place.",
};

export default function LibraryPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-xs text-neutral-500">
          <Link href="/" className="underline">
            Lifebook.AI
          </Link>{" "}
          / Library
        </p>
        <h1 className="text-3xl font-semibold">Library</h1>
        <p className="text-sm text-neutral-400">
          A simple place to keep the notes, runbooks, and artifacts you create while working
          through Lifebook workflows and Study Tracks.
        </p>
      </header>

      <section className="space-y-3 text-sm text-neutral-300">
        <p>
          For the MVP, your Library is wherever you already keep your work: Notion, Obsidian,
          OneNote, a private repo, or simple markdown files.
        </p>
        <p>
          Each Study Track step calls out an expected artifact. When you finish a step, save that
          artifact into your Library and tag it so you can find it later.
        </p>
        <p>
          As Lifebook grows, you&apos;ll be able to sync and organize those artifacts directly here.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Start from a Study Track</h2>
        <p className="text-sm text-neutral-300">
          Not sure where to begin? Start with a guided Study Track and capture the outputs into your Library.
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
