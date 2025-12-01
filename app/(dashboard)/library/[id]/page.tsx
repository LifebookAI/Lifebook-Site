import { notFound } from "next/navigation";
import { getLibraryItemById } from "@/lib/library/server";

type PageParams = Promise<{ id: string }>;

export default async function LibraryItemPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;

  const item = await getLibraryItemById(id);

  if (!item) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {item.title || `Library item ${id}`}
        </h1>
        {item.summary ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {item.summary}
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Artifact
        </h2>

        {item.bodyMarkdown || item.rawText ? (
          <pre className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-relaxed overflow-x-auto">
            {item.bodyMarkdown ?? item.rawText}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            No artifact body is available for this Library item yet.
          </p>
        )}
      </section>
    </div>
  );
}
