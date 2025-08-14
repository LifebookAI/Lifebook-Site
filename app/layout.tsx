// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Geist as GeistSans, Geist_Mono as GeistMono } from "next/font/google";

const geistSans = GeistSans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = GeistMono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://uselifebook.ai"),
  title:
    "Lifebook.AI — Turn long recordings into clean notes, clips, and a searchable archive.",
  description:
    "Upload audio or video. Get accurate transcripts, chaptered summaries with timestamps, and auto-detected highlight clips—ready to share.",
  openGraph: {
    type: "website",
    url: "https://uselifebook.ai",
    siteName: "Lifebook.AI",
    title:
      "Lifebook.AI — Turn long recordings into clean notes, clips, and a searchable archive.",
    description:
      "Upload audio or video. Get accurate transcripts, chaptered summaries with timestamps, and auto-detected highlight clips—ready to share.",
    images: [
      {
        url: "/og.png", // already in /public
        width: 1200,
        height: 630,
        alt: "Lifebook.AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@UseLifebookAi",
    creator: "@UseLifebookAi",
    title:
      "Lifebook.AI — Turn long recordings into clean notes, clips, and a searchable archive.",
    description:
      "Upload audio or video. Get accurate transcripts, chaptered summaries with timestamps, and auto-detected highlight clips—ready to share.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
