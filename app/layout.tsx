// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://uselifebook.ai"),
  title: "Lifebook.AI — Turn long recordings into clean notes, clips, and searchable archives",
  description:
    "Founders get a badge + first month of Pro free. Upload audio or video; get accurate transcripts, chaptered summaries with timestamps, and auto-highlighted clips.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Lifebook.AI",
    description:
      "Turn long recordings into clean notes, clips, and a searchable archive.",
    url: "https://uselifebook.ai/",
    siteName: "Lifebook.AI",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Lifebook.AI preview" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lifebook.AI",
    description:
      "Turn long recordings into clean notes, clips, and a searchable archive.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
robots: { index: false, follow: true },
