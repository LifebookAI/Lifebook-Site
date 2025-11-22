"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import React from "react";

type NavItem = {
  href: Route;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/workflows", label: "Workflows" },
  { href: "/captures", label: "Captures" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <header className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Lifebook OS
            </h1>
            <p className="text-xs text-slate-400">
              Developer Workflows & Learning OS — 30-day MVP.
            </p>
          </div>
          <nav className="flex gap-2 text-sm">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                pathname?.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={classNames(
                    "rounded-full px-3 py-1 transition",
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
