import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lifebook.AI — turn recordings into notes & clips",
  description: "Accurate transcripts, smart summaries, and auto highlight clips.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
