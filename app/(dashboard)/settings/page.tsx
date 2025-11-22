import React from "react";

export default function SettingsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-slate-300">
          Workspace, billing, and account controls. Step 21/22 will wire this
          into Stripe credits, storage meters, and abuse/fair-use policies.
        </p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        <p className="font-medium text-slate-100">
          For now this is a placeholder so navigation and layout are stable.
        </p>
      </div>
    </section>
  );
}
