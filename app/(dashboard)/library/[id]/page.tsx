import { LibraryDetailClient } from "./LibraryDetailClient";

export const dynamic = "force-dynamic";

// Library item detail page using typed routes for /library/[id].
export default async function LibraryDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  return (
    <LibraryDetailClient
      slug={id}
      primaryCtaLabel="Run this workflow"
      primaryCtaHint="Start a demo run for this Library item."
      isRunnable
    />
  );
}
