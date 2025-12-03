"use client";

import { useState } from "react";

type LibraryDetailClientProps = {
  slug: string;
  primaryCtaLabel: string;
  primaryCtaHint: string;
};

export function LibraryDetailClient({
  slug,
  primaryCtaLabel,
  primaryCtaHint,
}: LibraryDetailClientProps) {
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setStatus("running");
    setMessage("Starting run from this Library item...");

    try {
      const res = await fetch(`/api/library/${slug}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // ignore JSON parse errors, we will handle below
      }

      if (!res.ok || !json?.ok) {
        setStatus("error");
        setMessage(
          json?.error ??
            "Something went wrong starting this run. Please try again.",
        );
        return;
      }

      setStatus("ok");
      setMessage(
        "Run started. In the MVP, you will see this show up in your Library activity and workspace.",
      );
    } catch {
      setStatus("error");
      setMessage("Network error starting run. Check your connection and try again.");
    }
  }

  const buttonLabel =
    status === "running" ? "Starting..." : primaryCtaLabel;

  return (
    <section className="space-y-4">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md hover:shadow-slate-900/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        onClick={handleClick}
        disabled={status === "running"}
      >
        {buttonLabel}
      </button>
      <p className="max-w-xl text-xs text-slate-500">{primaryCtaHint}</p>
      {message && (
        <p className="max-w-xl text-xs text-slate-500">{message}</p>
      )}
    </section>
  );
}
