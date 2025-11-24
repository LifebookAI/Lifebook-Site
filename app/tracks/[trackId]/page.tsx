/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion */
export const dynamic = "force-dynamic";

/**
 * Stub page for /tracks/[trackId].
 * Keeps CI green while the real Study Track UI + backend are under construction.
 */
export default async function TrackPage(props: any) {
  const paramsPromise = (props as { params?: Promise<{ trackId: string }> }).params;
  const { trackId } =
    (paramsPromise && (await paramsPromise)) ?? { trackId: "unknown" };

  return (
    <main className="px-4 py-8">
      <h1 className="text-2xl font-semibold">Study Track (stub)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Track page for <code>{trackId}</code> is not implemented yet.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        This placeholder keeps the MVP CI build green while the real Study
        Tracks feature is being built.
      </p>
    </main>
  );
}

