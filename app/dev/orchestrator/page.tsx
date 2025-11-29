// Dev-only orchestrator index page
import Link from "next/link";

export const metadata = {
  title: "Orchestrator Dev Surface | Lifebook",
  description: "Quick links to orchestrator dev tools, docs, and smokes.",
};

export default function OrchestratorDevPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Orchestrator Dev Surface (J1)
        </h1>
        <p className="text-sm text-neutral-600">
          Local dev helpers for driving the <code>sample_hello_world</code> workflow
          end-to-end while we build out the full orchestrator.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Dev pages</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            <Link href="/dev/jobs" className="text-blue-600 hover:underline">
              /dev/jobs
            </Link>{" "}
            — Jobs Inspector. Paste a <code>job-…</code> id and optionally include logs.
          </li>
          <li>
            <Link href="/dev/jobs/run" className="text-blue-600 hover:underline">
              /dev/jobs/run
            </Link>{" "}
            — Jobs Runner. Fire <code>sample_hello_world</code> and watch it complete.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">CLI helpers</h2>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-mono space-y-1">
          <div className="font-semibold text-neutral-800">
            Orchestrator smoke (local dev)
          </div>
          <div>npm run orchestrator:smoke</div>
          <div className="text-neutral-500">
            # Runs <code>sample_hello_world</code>, then HEADs CloudFront{" "}
            <code>result.md</code>.
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-mono space-y-1">
          <div className="font-semibold text-neutral-800">
            Download result for a job
          </div>
          <div>npm run orchestrator:download -- -JobId "job-…"</div>
          <div className="text-neutral-500">
            # Fetches <code>result.md</code> via CloudFront and prints first 20 lines.
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Docs</h2>
        <p className="text-sm text-neutral-700">
          Full details live in{" "}
          <code>infra/orchestrator/README-dev.md</code>:
        </p>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>
            <code>run-job-and-wait.ps1</code> — generic job runner + poller.
          </li>
          <li>
            <code>smoke-hello-world.ps1</code> — creates{" "}
            <code>sample_hello_world</code> and checks CloudFront <code>result.md</code>.
          </li>
          <li>
            <code>download-result.ps1</code> — downloads <code>result.md</code>{" "}
            for any <code>jobId</code>.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Env knobs (dev)</h2>
        <ul className="list-disc pl-5 text-sm space-y-1 text-neutral-700">
          <li>
            <code>LFLBK_API_BASE_URL</code> — optional. Overrides the default{" "}
            <code>http://localhost:3000</code> for CLI helpers.
          </li>
          <li>
            <code>NEXT_PUBLIC_FILES_BASE_URL</code> — optional. Overrides{" "}
            <code>https://files.uselifebook.ai</code> for CloudFront links.
          </li>
        </ul>
      </section>
    </main>
  );
}
