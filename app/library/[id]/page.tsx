import { notFound } from "next/navigation";
import type { LibraryItemSummary } from "../../../lib/library/types";
import { listLibraryItemsForWorkspace } from "../../../lib/library/server";

interface PageProps {
  params: {
    id: string;
  };
}

async function getLibraryItem(id: string): Promise<LibraryItemSummary | null> {
  // TODO: derive workspaceId from auth/session once available.
  const workspaceId = "demo-workspace";
  const { items } = await listLibraryItemsForWorkspace(workspaceId, {});
  const match = items.find((item) => item.id === id);
  return match ?? null;
}

export default async function LibraryItemPage({ params }: PageProps) {
  const item = await getLibraryItem(params.id);

  if (!item) {
    notFound();
  }

  const created = new Date(item.createdAt).toLocaleString();

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="space-y-1">
        <p className="text-xs text-sky-400">
          <a href="/library" className="hover:underline">
            ← Back to Library
          </a>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
        {item.project && (
          <p className="text-sm text-gray-400">
            Project{" "}
            <span className="font-medium text-gray-200">{item.project}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
        <span className="inline-flex items-center rounded-full border border-gray-700 px-2 py-0.5 font-medium uppercase tracking-wide">
          {item.kind}
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5">
          Source: {item.sourceType}
        </span>
        {item.isPinned && (
          <span className="inline-flex items-center rounded-full bg-yellow-100/10 px-2 py-0.5 text-yellow-300">
            Pinned
          </span>
        )}
      </div>

      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-gray-200"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">Created: {created}</p>

      <section className="mt-4 rounded-lg border border-dashed border-gray-700 bg-slate-900/40 p-4 text-sm text-gray-400">
        <h2 className="mb-1 text-sm font-medium text-gray-200">
          Artifact preview (coming soon)
        </h2>
        <p>
          This is where the workflow output, capture transcript, or study pack
          will appear once the artifact viewers are wired up.
        </p>
      </section>
    </main>
  );
}
