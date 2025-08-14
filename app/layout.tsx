// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lifebook.AI — Clean notes, clips, searchable archive",
  description:
    "Upload audio/video. Get accurate transcripts, chaptered summaries, and highlight clips ready to share.",
  metadataBase: new URL("https://uselifebook.ai"),
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Solid text color (no opacity classes) */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b0f1a] text-white`}>
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/30 border-b border-white/10">
          <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              <span className="align-middle">Lifebook</span>
              <span className="align-middle text-sky-400">.AI</span>
            </Link>

            <ul className="flex items-center gap-6 text-sm text-white/80">
              <li><Link href="/#features" className="hover:text-white">Features</Link></li>
              <li><Link href="/#how" className="hover:text-white">How it works</Link></li>
              <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
              <li>
                <a
                  href="https://x.com/UseLifebookAi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/10"
                >
                  Follow on X
                </a>
              </li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </nav>
        </header>

        {/* Page content */}
        <main>{children}</main>

        {/* Footer */}
        <footer className="mx-auto max-w-6xl px-4 py-12 text-sm text-white/70">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span>© {new Date().getFullYear()} Lifebook.AI</span>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <a href="mailto:support@uselifebook.ai" className="hover:text-white">
              support@uselifebook.ai
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
