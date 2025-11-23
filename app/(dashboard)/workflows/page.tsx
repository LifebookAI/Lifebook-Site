import Link from "next/link";

export const metadata = {
  title: "Workflows – Lifebook.AI",
  description:
    "Kick off small, repeatable workflows and capture the artifacts into your Library as you go.",
};

export default function WorkflowsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-xs text-neutral-500">
          <Link href="/" className="underline">
            Lifebook.AI
          </Link>{" "}
          / Workflows
        </p>
        <h1 className="text-3xl font-semibold">Workflows</h1>
        <p className="text-sm text-neutral-400">
          This is where you&apos;ll run small, repeatable workflows that ship real artifacts into your
          Library while you learn.
        </p>
      </header>

      <section className="space-y-3 text-sm text-neutral-300">
        <p>
          For the MVP, workflows are simple guided runs: pick a track, follow the steps, and save the
          outputs into your Library. Under the hood, Lifebook will grow into a place where you can
          automate real computer work, not just generate notes.
        </p>
        <p>
          As the workflow engine comes online, you&apos;ll see your recent runs, their status, and links
          to the artifacts you created here.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Not sure where to start?</h2>
        <p className="text-sm text-neutral-300">
          Begin with a Study Track, then promote the steps you like into reusable workflows later.
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
