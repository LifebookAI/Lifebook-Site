import React from "react";

export default function CapturesPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Captures</h2>
        <p className="text-sm text-slate-300">
          Screen and audio notes that become transcripts, summaries, and tasks.
          MVP links this surface to capture ingestion and jobs that use Whisper
          and text summarization.
        </p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        <p className="font-medium text-slate-100">
          Next step (19A): Wire capture upload/record, transcript + summary,
          and &quot;Send to Notion&quot;.
        </p>
      </div>
    </section>
  );
}
