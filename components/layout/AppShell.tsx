"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppRoute = "/workflows" | "/captures" | "/library" | "/settings";

type NavItem = {
  href: AppRoute;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/workflows", label: "Workflows" },
  { href: "/captures", label: "Captures" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold tracking-tight">
            Lifebook OS
          </div>
          <nav className="flex items-center gap-4 text-xs font-medium text-slate-400">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive ? "text-slate-50" : "hover:text-slate-200"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
