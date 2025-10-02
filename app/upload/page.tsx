// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

// Keep this exported type so any imports from other files won't break.
export type SignedUpload = {
  url: string;
  headers: Record<string, string>;
  publicUrl: string;
  key: string;
};

// Minimal page to keep the route alive.
export default function UploadPage() {
  return <div className="p-6">Upload temporarily disabled.</div>;
}
