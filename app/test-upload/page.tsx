"use client";
import type { JSX } from "react";
import React, { useState } from "react";
import { uploadFile } from "@/lib/upload";

export default function Page(): JSX.Element {
  const [msg, setMsg] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMsg("Presigning...");
    void (async () => {
      try {
        const res = await uploadFile(f);
        setMsg(`OK. key=${res.key} etag=${res.etag ?? ""} publicUrl=${res.publicUrl ?? ""}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMsg(`ERROR: ${message}`);
      }
    })();
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Test Upload</h1>
      <input type="file" onChange={handleChange} />
      <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{msg}</pre>
    </main>
  );
}

