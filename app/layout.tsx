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

export const metadata: Metadata = {
  title: "Lifebook.AI",
  description:
    "Turn long recordings into clean notes, clips, and searchable archives.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://uselifebook.ai"),
  openGraph: {
    title: "Lifebook.AI",
    description:
      "Turn long recordings into clean notes, clips, and searchable archives.",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://uselifebook.ai",
    siteName: "Lifebook.AI",
    images: ["/og.png"],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lifebook.AI",
    description:
      "Turn long recordings into clean notes, clips, and searchable archives.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased min-h-screen bg-[#0b1220] text-white">
        {children}
      </body>
    </html>
  );
}
