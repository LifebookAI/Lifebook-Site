// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lifebook.AI",
  description:
    "Turn long recordings into clean notes, clips, and a searchable archive.",
  metadataBase: new URL("https://uselifebook.ai"),
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0b1220] text-gray-100 antialiased">
        {/* Header – dark, no gray bar */}
        <header className="sticky top-0 z-50 border-b border-white/5 bg-black/30 backdrop-blur-md">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="font-semibold text-white">Lifebook</span>
              <span className="text-sky-400">.AI</span>
            </Link>

            <div className="flex items-center gap-5 text-sm">
              <Link href="/#features" className="text-gray-200 hover:text-white">
                Features
              </Link>
              <Link href="/#how-it-works" className="text-gray-200 hover:text-white">
                How it works
              </Link>
              <Link href="/#faq" className="text-gray-200 hover:text-white">
                FAQ
              </Link>
              <a
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-gray-100 hover:bg-white/10"
                href="https://x.com/UseLifebookAi"
                target="_blank"
                rel="noreferrer"
              >
                Follow on X
              </a>
              <Link href="/contact" className="text-gray-200 hover:text-white">
                Contact
              </Link>
            </div>
          </nav>
        </header>

        {/* Page content */}
        <div className="min-h-[calc(100vh-56px)]">{children}</div>

        {/* Footer */}
        <footer className="border-t border-white/5 bg-black/20">
          <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-gray-400">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                © {new Date().getFullYear()} Lifebook.AI
              </div>
              <div className="flex items-center gap-4">
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
          </div>
        </footer>
      </body>
    </html>
  );
}
