import React from "react";

export default function LibraryPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Library</h2>
        <p className="text-sm text-slate-300">
          Unified search and recall for transcripts, workflow outputs, notes,
          and artifacts. For the MVP, this will connect to the library_items
          schema and basic keyword search.
        </p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        <p className="font-medium text-slate-100">
          Next step (19B): Implement search + recall (keyword + tags), backed
          by server-side search.
        </p>
      </div>
    </section>
  );
}
