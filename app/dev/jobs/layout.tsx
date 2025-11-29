import React from "react";
import Link from "next/link";

const tabs = [
  { href: "/dev/jobs", label: "Inspector" },
  { href: "/dev/jobs/run", label: "Runner" },
];

function isActive(href: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.pathname === href;
}

export default function DevJobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen px-6 py-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">
          Orchestrator dev surface (/dev/jobs)
        </h1>
        <p className="text-sm text-gray-500">
          Quick tools for driving the orchestrator locally while building:
          Inspector to look up jobs, Runner to create and poll new jobs.
        </p>

        <nav className="mt-4 flex gap-2 text-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-100 font-medium"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <section>{children}</section>
    </div>
  );
}
