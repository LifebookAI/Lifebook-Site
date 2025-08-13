export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6 text-white">
      <h1 className="text-3xl font-semibold">Terms of Use</h1>
      <p>Last updated: {new Date().toLocaleDateString()}</p>
      <p>The site is provided “as is,” without warranties. During prelaunch, features may change. Joining the waitlist means you agree to receive occasional product emails (you can opt out anytime).</p>
      <h2 className="text-xl font-medium">Contact</h2>
      <p><a className="underline" href="mailto:support@uselifebook.ai">support@uselifebook.ai</a></p>
      <p className="text-sm text-white/50">Informational only; not legal advice.</p>
    </main>
  );
}
