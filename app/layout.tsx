// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Lifebook.AI",
    template: "%s | Lifebook.AI",
  },
  description:
    "Turn long recordings into clean notes, clips, and a searchable archive.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://uselifebook.ai"),
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#0b1220] text-gray-200 antialiased`}
      >
        {/* Shared header (no white bar) */}
        <header className="sticky top-0 z-50">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
          <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="text-white font-semibold">
              Lifebook.<span className="text-sky-400">AI</span>
            </Link>

            <ul className="flex items-center gap-6 text-sm">
              <li>
                <Link href="#features" className="text-gray-300 hover:text-white">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#how" className="text-gray-300 hover:text-white">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="#faq" className="text-gray-300 hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="https://x.com/UseLifebookAi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-gray-200 hover:bg-white/10"
                >
                  Follow on X
                </a>
              </li>
              <li>
                <Link href="/contact" className="text-gray-300 hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
        </header>

        <main className="relative">{children}</main>

        <footer className="mt-20 border-t border-white/10 bg-white/[0.02]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-gray-400">
            <p>© {new Date().getFullYear()} Lifebook.AI</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
              <a href="mailto:support@uselifebook.ai" className="hover:text-white">
                support@uselifebook.ai
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
