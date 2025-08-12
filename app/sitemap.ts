// app/sitemap.ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://uselifebook.ai";
  const now = new Date();

  return [
    { url: `${base}/`,       lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/contact`,lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
