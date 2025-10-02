"use client";

import * as React from "react";
// Keep this exported type so any imports from other files won't break.
export type _SignedUpload = {
  url: string;
  headers: Record<string, string>;
  publicUrl: string;
  key: string;
};

// Minimal page to keep the route alive.
export default function UploadPage() {
  return <div className="p-6">Upload temporarily disabled.</div>;
}


