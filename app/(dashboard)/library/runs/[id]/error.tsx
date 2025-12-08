"use client";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LibraryRunDetailError({ error, reset }: Props) {
  console.error("LibraryRunDetailError boundary", error);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Run failed to load</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong while loading this run. You can try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border px-3 py-1 text-sm"
      >
        Retry
      </button>
    </div>
  );
}

