// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://uselifebook.ai";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Lifebook.AI",
    template: "%s | Lifebook.AI",
  },
  description:
    "Turn long recordings into clean notes, clips, and a searchable archive.",
  // STEALTH: block search engines while we’re in private/ perks-only mode
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Lifebook.AI",
    description:
      "Turn long recordings into clean notes, clips, and a searchable archive.",
    url: "/",
    siteName: "Lifebook.AI",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
